var ab = require('../../index.js')
var Promise = require('bluebird')
var Benchmark = require('benchmark')
var sumStats = require('summary-statistics')
import fs = require('fs')
var tube: string = 'test_tube'

ab.Server.listen()

var client = ab.Client.connect({maxJobs: 2, defaultEncoding: 'utf8'})
client.registerWorker(tube, (job) => {
	job.end(job.payload.toUpperCase())
})

var bench = new Benchmark('test abraxas', {
	'defer': true,
	'fn': function(deferred) {
		var jobs = []
		for (var i = 0; i < 100; i++) jobs.push(client.submitJob(tube, 'abc'))
		Promise.all(jobs).then(() => { deferred.resolve() })
	}
})
.on('cycle', function(event) { console.log(String(event.target)) })
.on('complete', function(event) {
	var summary = sumStats(bench.stats.sample)
	console.log(summary) 
})
.run({async: false})