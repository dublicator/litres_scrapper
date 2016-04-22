// This is a template for a Node.js scraper on morph.io (https://morph.io)

var cheerio = require("cheerio");
var request = require("request");
var sqlite3 = require("sqlite3").verbose();
var Promise = require("bluebird");

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

function run(db) {
	// Use request to read in pages.
	new Promise(function (resolve, reject) {
		fetchPage("http://www.litres.ru/zhanry/", function (body) {
			// Use cheerio to find things in the page with css selectors.
			var $ = cheerio.load(body);

			var elements = $("#genres_tree li div.title a").each(function () {
				var href = "http://www.litres.ru" + $(this).attr("href");
				console.log("Fetching "+href);
				fetchPage(href, function (childBody) {
					var $ = cheerio.load(childBody);

					var childElements = $(".newbook .booktitle a.title").each(function () {
						var value = $(this).text().trim();
						updateRow(db, value);
					});
				});
			});
		});
		resolve();
	})
		.then(readRows(db));
		//.then(db.close());
}

initDatabase(run);
