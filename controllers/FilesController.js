/* eslint-disable consistent-return */
/* eslint-disable prefer-const */
/* eslint-disable import/no-named-as-default */
import { ObjectId } from 'mongodb';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import { mime } from 'mime-types';
import path from 'path';
import redisClient from '../utils/redis';
import dbClient from '../utils/db';

const postUpload = async (req, res) => {
  const token = req.headers['x-token'];
  const redisKey = `auth_${token}`;
  const value = await redisClient.get(redisKey);
  const MongoId = new ObjectId(value);
  const database = dbClient.db.collection('users');
  const user = await database.findOne({ _id: ObjectId(MongoId) });
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  let {
    body: {
      name, type, parentId, isPublic, data,
    },
  } = req;
  parentId = parentId === undefined ? 0 : parentId;
  isPublic = isPublic === undefined ? false : isPublic;
  if (!name) {
    return res.status(400).send({ error: 'Missing name' });
  }
  if (!type || !['folder', 'file', 'image'].includes(type)) {
    return res.status(400).send({ error: 'Missing type' });
  }
  if (!data && type !== 'folder') {
    return res.status(400).send({ error: 'Missing data' });
  }
  if (parentId) {
    const fileCollection = await dbClient.db.collection('files');
    const findByParentId = await fileCollection.findOne({ parentId });
    // validate this code
    if (!findByParentId) {
      return res.status(400).send({ error: 'Parent not found' });
    }
    if (findByParentId.type === 'folder') {
      return res.status(400).send({ error: 'Parent is not a folder' });
    }
  }
  const newFileDocument = {
    userId: user._id, name, type, isPublic, parentId,
  };
  const fileCollection = await dbClient.db.collection('files');
  if (type === 'folder') {
    const output = await fileCollection.insertOne(newFileDocument);
    const mainOutput = { id: output.ops[0]._id, ...output.ops[0] };
    delete mainOutput._id;
    return res.status(201).send(mainOutput);
  }
  const relativePath = process.env.FOLDER_PATH || '/tmp/files_manager';
  if (!fs.existsSync(relativePath)) {
    fs.mkdirSync(relativePath, { recursive: true });
  }
  const localPath = uuidv4();
  fs.writeFileSync(path.join(relativePath, localPath), Buffer.from(data, 'base64'));
  const newFile = {
    userId: user._id,
    name,
    type,
    isPublic,
    parentId,
    localPath: ['file', 'image'].includes(type) ? localPath : null,
  };
  const ouput = await fileCollection.insertOne(newFile);
  const mainOutput = { id: ouput.ops[0]._id, ...ouput.ops[0] };
  delete mainOutput._id;
  return res.status(201).send(mainOutput);
};

const getShow = async (req, res) => {
  const { params: { id } } = req;
  const token = req.headers['x-token'];
  const redisKey = `auth_${token}`;
  const value = await redisClient.get(redisKey);
  const MongoId = new ObjectId(value);
  const database = dbClient.db.collection('users');
  const user = await database.findOne({ _id: ObjectId(MongoId) });
  if (!user) {
    return res.status(401).send({ error: 'Unauthorized' });
  }
  const fileCollection = await dbClient.db.collection('files');
  const fileData = await fileCollection.findOne({ _id: ObjectId(id) });
  if (!fileData) {
    return res.status(404).send({ error: 'Not found' });
  }
  return res.send(fileData);
};

const getIndex = async (req, res) => {
  const token = req.get('X-token');
  const key = `auth_${token}`;
  const userId = await redisClient.get(key);

  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const parentId = req.query.parentId || 0;
  const page = req.query.page || 0;

  const collection = await dbClient.db.collection('files');
  const files = await collection.aggregate([
    { $match: { userId, parentId } }, { $skip: page * 20 },
    { $limit: 20 },
  ]).toArray();

  res.json(files);
};

const putPublish = async (req, res) => {
  const { params: { id } } = req;
  const token = req.headers['x-token'];
  const redisKey = `auth_${token}`;
  const value = await redisClient.get(redisKey);
  const MongoId = new ObjectId(value);
  const database = dbClient.db.collection('users');
  const user = await database.findOne({ _id: ObjectId(MongoId) });
  if (!user) {
    return res.status(401).send({ error: 'Unauthorized' });
  }
  const fileCollection = await dbClient.db.collection('files');
  const fileData = await fileCollection.findOne({ _id: ObjectId(id) });
  if (!fileData) {
    return res.status(404).send({ error: 'Not found' });
  }
  await fileCollection.updateOne({ id: ObjectId(id) }, { $set: { isPublic: true } });
  return res.status(200).send(fileData);
};

const putUnpublish = async (req, res) => {
  const { params: { id } } = req;
  const token = req.headers['x-token'];
  const redisKey = `auth_${token}`;
  const value = await redisClient.get(redisKey);
  const MongoId = new ObjectId(value);
  const database = dbClient.db.collection('users');
  const user = await database.findOne({ _id: ObjectId(MongoId) });
  if (!user) {
    return res.status(401).send({ error: 'Unauthorized' });
  }
  const fileCollection = await dbClient.db.collection('files');
  const fileData = await fileCollection.findOne({ _id: ObjectId(id) });

  if (!fileData) {
    return res.status(404).send({ error: 'Not found' });
  }
  await fileCollection.updateOne({ id: ObjectId(id) }, { $set: { isPublic: false } });
  return res.status(200).send(fileData);
};

const getFile = async (req, res) => {
  const token = req.get('X-token');
  const key = `auth_${token}`;
  const userId = await redisClient.get(key);

  const { params: { id } } = req;
  const collection = await dbClient.db.collection('files');
  const file = await collection.findOne({ _id: ObjectId(id) });

  if (!file) {
    return res.status(404).json({ error: 'Not found' });
  }
  if ((file.isPublic === false) && (!userId || file.userId !== userId)) {
    return res.status(404).json({ error: 'Not found' });
  }
  if (file.type === 'folder') {
    return res.status(400).json({ error: 'A folder doesn\'t have content' });
  }
  const relativePath = process.env.FOLDER_PATH || '/tmp/files_manager';
  if (!fs.existsSync(path.join(relativePath, file.localPath))) {
    return res.status(404).json({ error: 'Not found' });
  }
  const fileData = fs.readFileSync(path.join(relativePath, file.localpath));
  const mimetype = mime.lookup(file.name);
  res.setHeader('Content-Type', mimetype);
  return res.status(200).send(fileData);
};

export {
  postUpload, getShow, getIndex, putPublish, putUnpublish, getFile,
};
