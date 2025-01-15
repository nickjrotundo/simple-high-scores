
# High Score Server

A simple Node.js-based server for managing high score submissions, retrievals, and displaying leaderboards.

---
## **General Notes**
  - I used an Oracle free-tier Ubuntu server for this. Any buntu/debian server will work with the install script. Any server that can run node can work but will require manual installation. 
  - Testing can be done without a domain name, but one will be needed if trying to use on itch.io as the requests need to be https and domain required for SSL. 
  - Be sure to allow inbound connections to TCP 3000 in the firewall in front of this server (like the Oracle network, or AWS, etc.)
  - Uniqueid for a player can be obtained by hashing, for example, their IP plus some system info available to the browser. Or, use your own method. 

## **Installation**

### **Step 1: Upload the Server to Your Server**
1. **Manual Transfer**:
   - Use an SFTP client (e.g., FileZilla, WinSCP) to upload the `high_score_server` directory to your server.
2. **Ensure Directory Structure**:
   ```plaintext
   high_score_server/
   ├── server.js
   ├── package.json
   └── setup_server.sh
   ```

---

### **Step 2: Set Up the Server**

1. **Run the Setup Script**:
   - SSH into your server.
   - Navigate to the `high_score_server` directory.
   - Make the setup script executable and run it:
     ```bash
     chmod +x setup_server.sh
     ./setup_server.sh
     ```

2. **What the Script Does**:
   - Installs Node.js, npm, SQLite3, express, CORS, and `pm2`.
   - Configures firewall rules for port 3000.
   - Installs dependencies from `package.json`.
   - Starts the server with `pm2`.
   - Optionally installs certificates via Let's Encrypt, which are needed generally due to CORS, but require a domain name. 

---

### **Step 3: Access the Server**

- Server will be accessible at:
  ```
  https://<your-server-domain>:3000
  ```

---

## **Endpoints**

### **1. `/submit_high_score`**
**Description**: Submits a new high score to the server.

**Method**: `POST`

**Payload**:
```json
{
  "initials": "AAA",
  "score": 100,
  "uniqueid": "2da8590a418273ef5f826d5ab0ca31a7c9465da7",
  "timestamp": "12/23/2024 1:37:10 PM",
  "hash": "computed_hash"
}
```
**Example Response**:
```json
{
  "success": true,
  "message": "High score submitted successfully"
}
```
**Hash Generation**:
- Concatenate the payload (excluding `hash`) with the shared secret key.
- Generate a SHA-1 hash of the concatenated string.

**Pseudocode Implementation**:
```pseudocode
function send_high_score():
    # Prepare payload with player data
    payload = {
        "initials": player_initials,
        "score": player_high_score,
        "uniqueid": player_uniqueid,
        "timestamp": current_datetime()
    }

    # Add security hash
    hash_input = JSON.stringify(payload) + secret_key
    payload["hash"] = sha1(hash_input)

    # Send payload to the server
    response = http_request("POST", "/submit_high_score", payload)

    if response.success:
        return true
    else:
        return response.error
```


---

### **2. `/get_high_scores`**
**Description**: Retrieves high scores for a specific user.

**Method**: `POST`

**Payload**:
```json
{
  "uniqueid": "2da8590a418273ef5f826d5ab0ca31a7c9465da7"
}
```
**Example Response**:
```json
{
  "success": true,
  "scores": [
    {
      "initials": "AAA",
      "score": 100,
      "timestamp": "12/23/2024 1:37:10 PM"
    },
    {
      "initials": "BBB",
      "score": 90,
      "timestamp": "12/23/2024 1:40:15 PM"
    }
  ]
}
```
**Pseudocode Implementation**:
```pseudocode
function retrieve_high_scores():
    # Prepare payload with player unique ID
    payload = {
        "uniqueid": player_uniqueid
    }

    # Send payload to the server
    response = http_request("POST", "/get_high_scores", payload)

    if response.success:
        return response.scores
    else:
        return response.error
```



---

### **3. `/get_top_10_scores`**
**Description**: Retrieves the top 10 global high scores.

**Method**: `GET`

**Example Response**:
```json
{
  "success": true,
  "scores": [
    {
      "initials": "CCC",
      "score": 336,
      "timestamp": "12/23/2024, 12:40:49 PM"
    },
    {
      "initials": "DDD",
      "score": 194,
      "timestamp": "12/23/2024, 12:40:49 PM"
    }
  ]
}
```

**Pseudocode Implementation**:
```pseudocode
function retrieve_top_10_scores():
    # Send GET request to the server
    response = http_request("GET", "/get_top_10_scores")

    if response.success:
        return response.scores
    else:
        return response.error
```



---

### **4. `/top_100`**
**Description**: Displays an HTML page with the top 100 global high scores.

**Method**: `GET`

---

## **Maintenance**

### **1. Monitoring Server with `pm2`**
- **View Status**:
  ```bash
  pm2 list
  ```
- **View Logs**:
  ```bash
  pm2 logs
  ```
  or for continuous monitoring, 
  ```bash
  pm2 dash
  ```

- **Restart the Server**:
  ```bash
  pm2 restart HSS
  ```

---

### **2. Checking Open Ports**
- **View Listening Ports**:
  ```bash
  ss -tuln
  ```
- Ensure port `3000` is open.

---

### **3. Updating Firewall Rules**
- Add a Rule Example: allow port tcp/3000
  ```bash
  sudo iptables -A INPUT -p tcp --dport 3000 -j ACCEPT
  ```
  
- Save Firewall Rules:
  ```bash
  sudo iptables-save | sudo tee /etc/iptables/rules.v4 > /dev/null
  sudo ip6tables-save | sudo tee /etc/iptables/rules.v6 > /dev/null
  sudo systemctl restart netfilter-persistent
  ```

---

### **4. Resetting the Database**
If the database becomes corrupted or needs resetting:
1. **Stop the Server**:
   ```bash
   pm2 stop HSS
   ```
2. **Delete the Database**:
   ```bash
   rm highscores.db
   ```
3. **Restart the Server**:
   ```bash
   pm2 start HSS
   ```

The database will automatically recreate itself on restart.

---

## **Additional Notes**

- **Secret Key**: Keep the `secretKey` in `server.js` private. If compromised, change it and update the client code.
- **SSL Certificates**: The command to run Certbot manually is: `sudo certbot certonly --standalone -d <your-server-domain> --preferred-challenges http`
- **Why SHA-1?**: SHA-1 is used for simplicity and compatibility with Gamemaker. If your game engine supports SHA-256, consider using it for increased security.

---

