const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const postgres = require("postgres");
const dns = require("dns");
const app = express();

// Basic Configuration
const port = process.env.PORT || 3000;
const { PGHOST, PGDATABASE, PGUSER, PGPASSWORD, ENDPOINT_ID } = process.env;
const sql = postgres({
  host: PGHOST,
  database: PGDATABASE,
  username: PGUSER,
  password: PGPASSWORD,
  port: 5432,
  ssl: "require",
  connection: {
    options: `project=${ENDPOINT_ID}`,
  },
});

app.use(cors());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use("/public", express.static(`${process.cwd()}/public`));
let db = [];

async function getLongUrl(shortUrl) {
  //console.log(await sql`SELECT "longurl" FROM links WHERE shorturl = ${shortUrl}`)
  return (
    await sql`SELECT "longurl" FROM links WHERE shorturl = ${shortUrl}`
  )[0]?.longurl;
}

async function getLongUrlFromBackup(shortUrl) {
  db = Array.from(db);
  console.log(
    db.filter((item) => {
      return item.shorturl == shortUrl;
    })[0]?.longurl
  );
  return db.filter((item) => {
    return item.shorturl == shortUrl;
  })[0]?.longurl;
}

async function getShortUrl(longUrl) {
  //console.log(await sql`SELECT "shorturl" FROM links WHERE longurl = ${longUrl}`);
  return (await sql`SELECT "shorturl" FROM links WHERE longurl = ${longUrl}`)[0]
    ?.shorturl;
}

async function listShortUrls() {
  return await sql`SELECT "shorturl" FROM links`;
}

async function insertRow(row) {
  console.log("INS:");
  console.log(row);
  //console.log();
  return await sql`INSERT INTO links ("uid", "longurl", "shorturl") VALUES (${row.uid}, ${row.longurl}, ${row.shorturl})`;
}

async function downloadDB() {
  return await sql`SELECT * FROM links;`;
}

function updateBackup(data) {
  //console.log(data)
  db = data;
}

async function start() {
  db = updateBackup(await downloadDB());
  //console.log(await getLongUrl("abcde"));
  //console.log(await gen_shorturl());
}
start();

setInterval(async () => {
  updateBackup(await downloadDB());
}, 1000);

async function gen_shorturl() {
  let shortUrls = await listShortUrls();

  let short = Array.from(Array(4), () =>
    Math.floor(Math.random() * 36).toString(36)
  ).join("");

  //get all existing short url
  if (!shortUrls) {
    return short;
  } else {
    //check if short url already exist
    let check_short = shortUrls.includes(short);
    if (check_short) {
      return await gen_shorturl();
    } else {
      return short;
    }
  }
}

app.get("/", (req, res) => {
  res.sendFile(process.cwd() + "/views/index.html");
});

app.get("/error", (req, res) => {
  res.sendFile(process.cwd() + "/views/error.html");
});

app.get("/success", (req, res) => {
  res.sendFile(process.cwd() + "/views/success.html");
});

app.post("/api/shorturl", async (req, res) => {
  let input = "",
    domain = "",
    param = "",
    short = 0;

  input = req.body.url;
  if (input === null || input === "") {
    return res.json({ error: "invalid url" });
  }
  domain = input.match(
    /^(?:https?:\/\/)?(?:[^@\/\n]+@)?(?:www\.)?([^:\/?\n]+)/gim
  );
  param = domain[0].replace(/^https?:\/\//i, "");

  dns.lookup(param, async (err, ip) => {
    if (err) {
      //If url is not valid -> respond error
      console.log(ip);
      return res.redirect("/error");
    } else {
      console.log("inserting...");
      //If url is valid -> generate short url
      let existingUrl = await getShortUrl(input);
      if (existingUrl) {
        console.log("lol");
        return res.redirect("/success?url=" + existingUrl);
      } else {
        console.log("still inserting...");
        short = (await gen_shorturl()).toLowerCase();
        console.log(
          await insertRow({ uid: 1, shorturl: short, longurl: input })
        );
        console.log("inserted");
        await downloadDB();
      }
      return res.redirect("/success?url=" + short);
    }
  });
});

app.get("/:shorturl", async (req, res) => {
  let input = req.params.shorturl;
  let longUrl = await getLongUrlFromBackup(input.toLowerCase());
  console.log(longUrl);
  if (!longUrl) {
    res.sendFile(process.cwd() + "/views/error.html");
    return;
  }
  if (!longUrl.startsWith("http")) {
    longUrl = "https://" + longUrl;
  }
  res.redirect(longUrl);
});
// Your first API endpoint
//app.get('/api/hello', function(req, res) {
//  res.json({ greeting: 'hello API' });
//});

app.listen(port, function () {
  console.log(`Listening on port ${port}`);
});
