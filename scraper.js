// This is a template for a Node.js scraper on morph.io (https://morph.io)

var cheerio = require("cheerio");
var request = require("request");
var sqlite3 = require("sqlite3").verbose();
var Queue = require('better-queue');

function initDatabase(callback) {
	// Set up sqlite database.
	var db = new sqlite3.Database("data.sqlite");
	db.serialize(function() {
		var sql = "CREATE TABLE IF NOT EXISTS books (" +
			"Id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT" +
			", title TEXT  NOT NULL" +
			", description TEXT NULL" +
			", age_limit TEXT  NULL" +
			", author TEXT NULL" +
			", url TEXT  UNIQUE NOT NULL" +
			", year INTEGER  NULL)";
		db.run(sql);
		callback(db);
	});
}

function insertBook(db, title, description, age_limit, author, url, year) {
	// Insert some data.
	var statement = db.prepare("INSERT OR IGNORE INTO books VALUES (NULL, ?,?,?,?,?,?)");
	statement.run(title, description, age_limit, author, url, year);
	statement.finalize();
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
					var href = "http://www.litres.ru" + $(this).attr("href")+"elektronnie-knigi/?limit=120";
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
			var statement = db.prepare("SELECT * from books where url=?");
			statement.get(result.url, function (err, row) {
				if(row===undefined){
					console.log("Fetching page "+ result.url);
					fetchPage(result.url, function (body) {
						var $ = cheerio.load(body);
						var title = $("h1.book-title").text().trim();
						var description = $(".book_annotation").text();
						var age_limit = null;//todo
						var author = $(".book-author .h2 nobr a").text().trim();
						var year = null;//todo
						insertBook(db, title, description, age_limit, author, result.url, year);
					});
				}
				cb(null);
			});
			statement.finalize();
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
