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

function pushJobs() {
		var jobs = []
		for (var i = 0; i < 50; i++) jobs.push(client.submitJob(tube, 'abc'))
		return Promise.all(jobs)
}

var bench = new Benchmark('test abraxas', {
	'defer': true,
	'maxTime' : 60,
	'minRuns' : 20,
	'initCount' : 3,
	'fn': (deferred) => pushJobs().then(() => deferred.resolve())
})
.on('cycle', function(event) { process.stdout.write('\r' + String(event.target)) + "            " })
.on('complete', function(event) {
	var summary = sumStats(bench.stats.sample)
	console.log('\n')
	console.log("%s,%s,%s", summary.median.toFixed(3), (summary.median - summary.q1).toPrecision(2), (summary.q3 - summary.median).toPrecision(2))
})

pushJobs().then(() => pushJobs().then(() => bench.run({async: false})))
