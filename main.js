#!/usr/bin/env node

const redisClient = require('./utils/redis');

(async () => {
    console.log(await redisClient.isAlive()); // Should print: true
    console.log(await redisClient.get('myKey')); // Should print: null initially

    await redisClient.set('myKey', 12, 5);
    console.log(await redisClient.get('myKey')); // Should print: 12

    setTimeout(async () => {
        console.log(await redisClient.get('myKey')); // Should print: null after 5 seconds
    }, 1000 * 10); // Wait 10 seconds to check
})();
