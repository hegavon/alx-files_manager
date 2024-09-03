#!/usr/bin/env node

const { createClient } = require('redis');
const { promisify } = require('util');

class RedisClient {
  constructor() {
    this.client = createClient({ url: 'redis://localhost:6379' });

    this.client.on('error', (error) => {
      console.log(`Redis client not connected to server: ${error}`);
    });

    this.client.on('connect', () => {
      console.log('Redis client connected to server');
    });
  }

  // Check connection status and report
  async isAlive() {
    try {
      await this.client.ping();
      return true;
    } catch (error) {
      console.log(`Ping failed: ${error}`);
      return false;
    }
  }

  // Get value for given key from Redis server
  async get(key) {
    const redisGet = promisify(this.client.get).bind(this.client);
    const value = await redisGet(key);
    return value;
  }

  // Set key-value pair to Redis server
  async set(key, value, time) {
    const redisSet = promisify(this.client.set).bind(this.client);
    await redisSet(key, value);
    await this.client.expire(key, time);
  }

  // Delete key-value pair from Redis server
  async del(key) {
    const redisDel = promisify(this.client.del).bind(this.client);
    await redisDel(key);
  }
}

const redisClient = new RedisClient();

module.exports = redisClient;
