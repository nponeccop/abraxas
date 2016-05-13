var ab = require('../index.js')
var Promise = require('bluebird')
var Benchmark = require('benchmark')
var sumStats = require('summary-statistics')
import fs = require('fs')
import assert = require('assert')
var tube: string = 'test_tube'

ab.Server.listen()

function createPythonFile(suiteResults, benchmarksOpts) {
	var data = '';
	var yerrTop = '';
	var yerrBottom = '';
	for (var i = 0; i < suiteResults.length; i++) {
		var bench = suiteResults[i];
		var benchmarkOptions = benchmarksOpts[i];
		var summary = sumStats(bench.stats.sample.map((x) => x / benchmarkOptions.jobsCount))
		
		var v1 = summary.median.toPrecision(3)
		var v2 = (summary.median - summary.q1).toPrecision(2)
		var v3 = (summary.q3 - summary.median).toPrecision(2)
		data += `${v1},`
		yerrTop += `${v2},`
		yerrBottom += `${v3},`
	}
	
	var code = `%matplotlib notebook\
				\n\
				\nimport pandas as pd\
				\n\
				\ndf = pd.DataFrame([${data}])\
				\ndf.plot(kind="bar", yerr=[[[${yerrBottom}],[${yerrTop}]]])`
	fs.writeFile('results.py', code, 'utf8', err => { if (err) throw err; console.log('It\'s saved!') })
}

function pushJobs(jobsCount, abraxasClient) {
	var jobs = []
	for (var i = 0; i < jobsCount; i++) jobs.push(abraxasClient.submitJob(tube, 'abc'))
	return Promise.all(jobs)
}

function getHotClient(benchmarkOptions) {
	var client = ab.Client.connect(benchmarkOptions.abraxasOptions)
	client.registerWorker(tube, (job) => {
		setTimeout(() => job.end(job.payload.toUpperCase()), 100)
	})
		
	return new Promise((resolve) => {
		pushJobs(benchmarkOptions.jobsCount, client).then(() => resolve(client))        
    })
}

function createBench(name, jobsCount, client) {
	return new Benchmark.Benchmark(name, {
		defer: true,
		maxTime: 60,
		minRuns: 20,
		initCount: 3,
		fn: (deferred) => pushJobs(jobsCount, client).then((results) => {
			results.forEach(result => assert.equal(result, 'ABC'))
			deferred.resolve()
		}),
		onCycle: function (event) { process.stdout.write('\r' + String(event.target)) + "            " }		
	})
}

function goBench(benchmarkOptions) {
	return new Promise((resolve) => {
		getHotClient(benchmarkOptions).then(client => {
			var bench = createBench(benchmarkOptions.name, benchmarkOptions.jobsCount, client).run({async: false})
			bench.on('complete', () => {
				process.stdout.write('\n')
				client.forgetAllWorkers()
				client.disconnect()
				resolve(bench)
			})
		})
    })
}

function goBenchmarks(benchmarksOptions) {	
	var results = []
	return new Promise(resolve => {
		goBench(benchmarksOptions[0]).then(result0 => {
			results.push(result0)
			goBench(benchmarksOptions[1]).then(result1 => {
				results.push(result1)
				goBench(benchmarksOptions[2]).then(result2 => {
					results.push(result2)
					resolve(results)
				})
			})
		})
	})	
}

var benchmarksOptions = [
	{ name: 'abraxas jobs=100, queue=10, active=10', jobsCount: 100, abraxasOptions: { maxQueued: 10, maxJobs: 10, defaultEncoding: 'utf8' } },
	{ name: 'abraxas jobs=100, queue=20, active=10', jobsCount: 100, abraxasOptions: { maxQueued: 20, maxJobs: 10, defaultEncoding: 'utf8' } },
	{ name: 'abraxas jobs=100, queue=40, active=10', jobsCount: 100, abraxasOptions: { maxQueued: 40, maxJobs: 10, defaultEncoding: 'utf8' } }]

goBenchmarks(benchmarksOptions).then(results => createPythonFile(results, benchmarksOptions))