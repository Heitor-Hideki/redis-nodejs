import 'express-async-errors';
import express, { Request, Response, NextFunction } from 'express';
import { createClient } from 'redis';

const redisClient = createClient();

const app = express();

app.use(express.json());

const PORT = process.env.PORT || 3333;

app.get('/', async (request, response) => {
  return response.status(200).json({ status: 'ok' });
});

app.post('/setValue', async (request, response) => {
  const { value } = request.body;

  await redisClient.set('key', value);
  // await redisClient.set('key', value, { EX: 10 }); // timer de expiração: 10 segundos

  return response.status(204).json({});
});

app.get('/getValue', async (request, response) => {
  const value = await redisClient.get('key');

  return response.status(200).json({ value: value });
});

app.get('/deleteValue', async (request, response) => {
  await redisClient.del('key');

  return response.status(204).json({});
});

app.use((error: Error, request: Request, response: Response, next: NextFunction) => {
  // if (error instanceof AppError) {
  //   console.log('🪿🪿🪿 AppError ', JSON.stringify(error));

  //   return response.status(error.statusCode).json({
  //     status: 'error',
  //     error: error.message,
  //   });
  // }

  console.log('❗❗❗ error', error);

  return response.status(500).json({
    status: 'error',
    error: 'Internal server error',
  });
})

const bootUp = async () => {
  await redisClient.connect();

  app.listen(PORT, () => {
    console.log(`🚀 Server started on port ${PORT}`);
  });
}

bootUp();
