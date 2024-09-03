import { MongoClient } from 'mongodb';


class DBClient {
  constructor() {
    this.connected = false
    const HOST = process.env.DB_HOST || 'localhost';
    const PORT = process.env.DB_PORT || 27017;
    const DATABASE = process.env.DB_DATABASE || 'files_manager';
    const url = `mongodb://${HOST}:${PORT}`;
    this.client = new MongoClient(url, {
      useUnifiedTopology: true,
      useNewUrlParser: true,
    });
    this.client
      .connect()
      .then(() => {
        this.connected = true
        this.db = this.client.db(`${DATABASE}`);
      })
      .catch((err) => {
        console.log(err);
      });
  }
  isAlive() {
    return this.connected
  }

  async nbUsers() {
    const users = this.db.collection('users');
    const numUsers = await users.countDocuments();
    return numUsers;
  }

  async nbFiles() {
    const files = this.db.collection('files');
    const numFiles = await files.countDocuments();
    return numFiles;
  }
}

const dbClient = new DBClient();

module.exports = dbClient;

