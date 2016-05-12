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
		data += `${v2},`
		yerrTop += `${v3},`
		yerrBottom += `${v1},`
	}
	
	var code = `%matplotlib notebook\
				\n\
				\nimport pandas as pd\
				\n\
				\ndf = pd.DataFrame([${data}])\
				\ndf.plot(kind="bar", yerr=[[[${yerrBottom}],[${yerrTop}]]])`
	fs.writeFile('results.py', code, 'utf8', err => { if (err) throw err; console.log('It\'s saved!') })
}

function pushJobs(jobsCount, abraxasOptions) {
	var client = ab.Client.connect(abraxasOptions)
	client.registerWorker(tube, (job) => {
		setTimeout(() => job.end(job.payload.toUpperCase()), 100)
	})

	var jobs = []
	for (var i = 0; i < jobsCount; i++) jobs.push(client.submitJob(tube, 'abc'))
	return Promise.all(jobs)
}

function createBench(benchmarkOptions) {
	return {
		'name': benchmarkOptions.name,
		'defer': true,
		'maxTime': 60,
		'minRuns': 20,
		'initCount': 3,
		'fn': (deferred) => pushJobs(benchmarkOptions.jobsCount, benchmarkOptions.abraxasOptions).then((results) => {
			results.forEach(result => assert.equal(result, 'ABC'))
			deferred.resolve()
		}),
		'onCycle': function (event) { process.stdout.write('\r' + String(event.target)) + "            " },
		'onComplete': function (event) { process.stdout.write('\n') }
	}
}

function goBench(benchmarksOptions) {
	var suite = new Benchmark.Suite;
	benchmarksOptions.forEach(opt => suite.add(createBench(opt)))
	return suite
}

var benchmarksOptions = [
	{ name: 'abraxas jobs=100, queue=10, active=10', jobsCount: 100, abraxasOptions: { maxQueued: 10, maxJobs: 10, defaultEncoding: 'utf8' } },
	{ name: 'abraxas jobs=100, queue=20, active=10', jobsCount: 100, abraxasOptions: { maxQueued: 20, maxJobs: 10, defaultEncoding: 'utf8' } },
	{ name: 'abraxas jobs=100, queue=40, active=10', jobsCount: 100, abraxasOptions: { maxQueued: 40, maxJobs: 10, defaultEncoding: 'utf8' } }]

var defaultAbraxasOptions = { maxQueued: 30, maxJobs: 10, defaultEncoding: 'utf8' }
pushJobs(150, defaultAbraxasOptions)
	.then(() => pushJobs(150, defaultAbraxasOptions)
		.then(() => goBench(benchmarksOptions)
			.run({ async: false })
			.on('complete', (event) => { createPythonFile(event.currentTarget, benchmarksOptions) }) ))