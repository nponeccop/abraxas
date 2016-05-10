var ab = require('../index.js')
var Promise = require('bluebird')
var Benchmark = require('benchmark')
var sumStats = require('summary-statistics')
import fs = require('fs')
var tube: string = 'test_tube'

ab.Server.listen()

var client = ab.Client.connect({maxJobs: 10, defaultEncoding: 'utf8'})
client.registerWorker(tube, (job) => {
	setTimeout(() => job.end(job.payload.toUpperCase()), 100)
})

function pushJobs(sz) {
		var jobs = []
		for (var i = 0; i < sz; i++) jobs.push(client.submitJob(tube, 'abc'))
		return Promise.all(jobs)
}

function goBench(sz)
{


var bench = new Benchmark('abraxas-' + sz, {
	'defer': true,
	'maxTime' : 60,
	'minRuns' : 20,
	'initCount' : 3,
	'fn': (deferred) => pushJobs(sz).then(() => deferred.resolve())
})
.on('cycle', function(event) { process.stdout.write('\r' + String(event.target)) + "            " })
.on('complete', function(event) {
	var summary = sumStats(bench.stats.sample.map((x) => x / sz))
	console.log('\n')
	console.log("%s,%s,%s", summary.median.toPrecision(3), (summary.median - summary.q1).toPrecision(2), (summary.q3 - summary.median).toPrecision(2))
	})
	return bench
}

pushJobs(150).then(() => pushJobs(150).then(() => goBench(100).run({async: false})))

