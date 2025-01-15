/*
 * High Score Server for Game Jam
 * 
 * This server was built as part of a game jam project and is intended for demonstration purposes.
 * While efforts have been made to ensure basic functionality, it has NOT undergone thorough 
 * security testing or optimization for production environments. 
 * 
 * Use this code as a reference or starting point, but you are strongly advised to:
 * - Perform a comprehensive security audit before deploying in a production environment.
 * - Replace placeholder values (e.g., secret keys, file paths) with secure and environment-specific configurations.
 * - Implement additional security measures such as rate limiting, input sanitization, and HTTPS enforcement.
 * 
 * Author: Nick R | Last Update: 12/24/2024 
 */
const https = require("https");
const fs = require("fs");
const express = require("express");
const bodyParser = require("body-parser");
const sqlite3 = require("sqlite3").verbose();

const app = express();
const PORT = 3000;
const cors = require("cors");
const crypto = require("crypto");
const secretKey = "REPLACE_WITH_SECURE_SECRET_KEY"; // GENERATE A NEW SECRET KEY!! Use it in your game as well to make the SHA-1 hash to check against. 

// Enable CORS for specific origins
app.use(cors({
    origin: [
        // /.yourdomain\.com$/, // The main domain for your website
        /\.itch\.io$/, // The main domain for itch.io
        /\.itch\.zone$/], // The one where games seemed to be served from
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type"],
}));
// Middleware
app.use(bodyParser.json());

// Load SSL Certificates - Replace with the actual paths to your SSL certificate files if different. If you used the setup script, it will have outputted the folder where these files are.
const options = {
    key: fs.readFileSync("/home/ubuntu/certs/privkey.pem"),
    cert: fs.readFileSync("/home/ubuntu/certs/fullchain.pem"),
};

// Initialize SQLite Database - Change this to your desired database file name/path
const DB_FILE = "highscores.db";
const db = new sqlite3.Database(DB_FILE, (err) => {
    if (err) {
        console.error("Error opening database:", err.message);
    } else {
        console.log("Connected to SQLite database.");
        db.run(
            `CREATE TABLE IF NOT EXISTS scores (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                initials TEXT NOT NULL,
                score INTEGER NOT NULL,
                uniqueid TEXT NOT NULL,
                timestamp INTEGER NOT NULL
            );`
        );
    }
});

function parseTimestamp(timestamp) {
    const parts = timestamp.split(/[/: ]/);
    if (parts.length !== 6) {
        throw new Error("Invalid timestamp format");
    }
    const [day, month, year, hours, minutes, seconds] = parts.map(Number);
    return Math.floor(new Date(year, month - 1, day, hours, minutes, seconds).getTime() / 1000);
}

// Save High Score
app.post("/submit_high_score", (req, res) => {
    const { initials, score, uniqueid, timestamp, hash } = req.body;
    console.log("Received payload:", req.body);

    // Validate fields
    if (typeof initials !== "string" || initials.trim() === "") {
        return res.status(400).json({ success: false, error: "Invalid or missing 'initials'" });
    }

    if (typeof score !== "number" || score < 0) {
        return res.status(400).json({ success: false, error: "Invalid or missing 'score'" });
    }

    if (typeof uniqueid !== "string" || uniqueid.trim() === "") {
        return res.status(400).json({ success: false, error: "Invalid or missing 'uniqueid'" });
    }

    if (typeof timestamp !== "string" || timestamp.trim() === "") {
        return res.status(400).json({ success: false, error: "Invalid or missing 'timestamp'" });
    }

    if (typeof hash !== "string" || hash.trim() === "") {
        return res.status(400).json({ success: false, error: "Invalid or missing 'hash'" });
    }

    // Recompute the hash
    const payload = { initials, score, uniqueid, timestamp };
    const hashInput = JSON.stringify(payload) + secretKey;
    const recomputedHash = crypto.createHash("sha1").update(hashInput).digest("hex");
    console.log("Received hash:", hash);
    console.log("Recomputed hash:", recomputedHash);

    // Compare hashes
    if (hash !== recomputedHash) {
        return res.status(403).json({ success: false, error: "Invalid hash" });
    }


    let unixTimestamp;
    try {
        unixTimestamp = parseTimestamp(timestamp);
    } catch (err) {
        return res.status(400).json({ success: false, error: "Invalid timestamp format" });
    }

    // Insert into database
    const sql = `INSERT INTO scores (initials, score, uniqueid, timestamp)
                 VALUES (?, ?, ?, ?)`;
    db.run(sql, [initials, score, uniqueid, unixTimestamp], (err) => {
        if (err) {
            return res.status(500).json({ success: false, error: err.message });
        }
        res.json({ success: true, message: "High score submitted successfully" });
    });
});

// Get Player High Scores
app.post("/get_high_scores", (req, res) => {
    const { uniqueid } = req.body;
    console.log("Received payload:", req.body);


    if (!uniqueid) {
        return res.status(400).json({ success: false, error: "Missing unique ID" });
    }

    const sql = `SELECT initials, score, timestamp FROM scores WHERE uniqueid = ? ORDER BY score DESC`;
    db.all(sql, [uniqueid], (err, rows) => {
        if (err) {
            return res.status(500).json({ success: false, error: err.message });
        }
        // Format the timestamp for output
        rows.forEach(row => {
            row.timestamp = new Date(row.timestamp * 1000).toLocaleString("en-US");
        });
        console.log("Responding with:", JSON.stringify(rows));
        res.json({ success: true, scores: rows });
    });
});

// Get Top 10 High Scores
app.get("/get_top_10_scores", (req, res) => {
    console.log("Received get top 10 request.");
    const sql = `SELECT initials, score, timestamp FROM scores ORDER BY score DESC LIMIT 10`;
    db.all(sql, [], (err, rows) => {
        if (err) {
            return res.status(500).json({ success: false, error: err.message });
        }
        // Format the timestamp for output
        rows.forEach(row => {
            row.timestamp = new Date(row.timestamp * 1000).toLocaleString("en-US");
        });
        console.log("Responding with:", JSON.stringify(rows));
        res.json({ success: true, scores: rows });
    });
});

app.get("/api/top_100", (req, res) => {
    const sql = `SELECT initials, score, timestamp FROM scores ORDER BY score DESC LIMIT 100`;

    db.all(sql, [], (err, rows) => {
        if (err) {
            return res.status(500).json({ error: "Error retrieving high scores." });
        }

        res.json(rows);
    });
});

// Serve the HTML page. Modify the styling as needed.
app.get("/top_100", (req, res) => {
    let html = `
    <!DOCTYPE html>
<html>
<head>
    <title>Global High Scores</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 0; padding: 0; }
        table { width: 98%; border-collapse: collapse; margin: 10px auto; }
        th, td { color: #EEEDEE; padding: 8px 12px; text-align: left; border: 1px solid #ddd; }
        th { background-color: #402670; }
        tr:nth-child(even) { background-color: #6683B5; }
        tr:nth-child(odd) { background-color: #716B86; }
    </style>
    <script>
        // Function to refresh table contents
        async function refreshTable() {
            try {
                const response = await fetch('/api/top_100');
                const rows = await response.json();

                const tbody = document.querySelector('tbody');
                tbody.innerHTML = ''; // Clear current table rows

                rows.forEach((row, index) => {
                    const tr = document.createElement('tr');
                    tr.title = \`Submitted at: \${new Date(row.timestamp * 1000).toLocaleString("en-US")}\`; // This might actually double-count for timezone differences. 
                    tr.innerHTML = \`
                        <td>\${index + 1}</td>
                        <td>\${row.initials}</td>
                        <td>\${row.score}</td>
                    \`;
                    tbody.appendChild(tr);
                });
            } catch (error) {
                console.error('Error refreshing table:', error);
            }
        }

        // Refresh the table every 10 seconds
        setInterval(refreshTable, 10000);

        // Initial load
        document.addEventListener('DOMContentLoaded', refreshTable);
    </script>
</head>
<body>
    <h1 style="text-align: center;color:#EEEDEE;">Global High Scores</h1>
    <table>
        <thead>
            <tr>
                <th>Rank</th>
                <th>Initials</th>
                <th>Score</th>
            </tr>
        </thead>
        <tbody>
            <!-- Rows will be dynamically loaded -->
        </tbody>
    </table>
</body>
</html>
    `;

    res.send(html);
});
// Redirect HTTP to HTTPS
const httpApp = express();
httpApp.use((req, res) => {
    res.redirect(`https://${req.headers.host}${req.url}`);
});

// Start HTTPS Server
https.createServer(options, app).listen(PORT, "0.0.0.0", () => {
    console.log(`High Score Server running on port ${PORT}`);
});
