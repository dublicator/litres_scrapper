// This is a template for a Node.js scraper on morph.io (https://morph.io)

var cheerio = require("cheerio");
var request = require("request");
var sqlite3 = require("sqlite3").verbose();
var Promise = require("bluebird");
var Queue = require('better-queue');

function initDatabase(callback) {
	// Set up sqlite database.
	var db = new sqlite3.Database("data.sqlite");
	db.serialize(function() {
		db.run("CREATE TABLE IF NOT EXISTS book (title TEXT)");
		callback(db);
	});
}

function updateRow(db, value) {
	// Insert some data.
	var statement = db.prepare("INSERT INTO book VALUES (?)");
	statement.run(value);
	statement.finalize();
}

function readRows(db) {
	// Read some data.
	db.each("SELECT rowid AS id, title FROM book", function(err, row) {
		console.log(row.id + ": " + row.title);
	});
}

function fetchPage(url, callback) {
	// Use request to read in pages.
	request(url, function (error, response, body) {
		if (error) {
			console.log("Error requesting page: " + error);
			return;
		}

		callback(body);
	});
}

function run(db){
	var q = new Queue(function (result, cb) {
		if(result.type==="categories"){
			console.log("Fetching page " + result.url);
			fetchPage(result.url, function (body) {
				var $ = cheerio.load(body);
				$("#genres_tree li div.title a").each(function () {
					var href = "http://www.litres.ru" + $(this).attr("href");
					q.push({type: "category", url: href});
				});
				cb(null);
			});
		}
		else if(result.type==="category"){
			console.log("Fetching page "+ result.url);
			fetchPage(result.url, function (body) {
				var $ = cheerio.load(body);
				$(".newbook .booktitle a.title").each(function () {
					var href = "http://www.litres.ru" + $(this).attr("href");
					q.push({type: "page", url: href});
				});
				cb(null);
			});
		} else if(result.type === "page") {
			console.log("Fetching page "+ result.url);
			fetchPage(result.url, function (body) {
				var $ = cheerio.load(body);
				var title = $("h1.book-title").text().trim();
				updateRow(db, title);
				cb(null);
			});
		} else {
			throw new Error("Not implemented");
		}
	}, {concurrent: 5})
		.on('task_finish', function (taskId, result, stats) {
			//console.log("Task succeeded with "+result);
		})
		.on('task_failed', function (taskId, err, stats) {
			console.error("Task failed: " + err);
			// Handle error, stats = { elapsed: <time taken> }
		})
		.on('drain', function (){
			console.log("All tasks finished");
			db.close();
			process.exit();
		});

	var page = {type: "categories", url: "http://www.litres.ru/zhanry/"};
	q.push(page);
}

initDatabase(run);
