import 'express-async-errors';
import express, { Request, Response, NextFunction } from 'express';
import { createClient } from 'redis';
import cors from 'cors';
import { Readable } from 'stream';
import { products } from './products';
import { TCart, TCartItem } from './models';

const redisClient = createClient();

const app = express();

app.use(express.json());
app.use(cors());

const PORT = process.env.PORT || 3333;

async function ensureRedisConnection(request: Request, response: Response, next: NextFunction) {
  console.log('connection', redisClient.isOpen);

  if(!redisClient.isOpen){ 
    await redisClient.connect();
  }

  return next();
}

app.get('/', async (request, response) => {
  return response.status(200).json({ status: 'ok' });
});

app.get('/products', async (request, response) => {
  return response.status(200).json({ products: products });
});

app.post('/updateCart', async (request, response) => {
  const { cart } = request.body;

  await redisClient.set('cart', JSON.stringify(cart));
  // await redisClient.set('key', value, { EX: 10 }); // timer de expiração: 10 segundos

  return response.status(204).json({});
});

app.post('/addProduct', ensureRedisConnection, async (request, response) => {
  const { productId } = request.body;

  const product = products.find(product => product.id === productId);
  const cartData = await redisClient.get('cart');
  const cart: TCart = JSON.parse(cartData);

  if(!cart || cart.length === 0){
    const cartItem: TCartItem = {
      item: product,
      quantity: 1
    };
    await redisClient.set('cart', JSON.stringify([cartItem]));

    return response.status(204).json({});
  } 

  const isItemInCart = cart.find(entry => entry.item.id === product.id);

  if(!!isItemInCart) {
    const itemIndex = cart.findIndex(entry => entry.item.id === product.id);
    cart[itemIndex].quantity += 1;
    await redisClient.set('cart', JSON.stringify(cart));

    return response.status(204).json({});
  }

  cart.push({
    item: product,
    quantity: 1
  });
  await redisClient.set('cart', JSON.stringify(cart));
  // await redisClient.set('key', value, { EX: 10 }); // timer de expiração: 10 segundos

  return response.status(204).json({});
});

app.post('/removeProduct', ensureRedisConnection, async (request, response) => {
  const { productId } = request.body;

  const product = products.find(product => product.id === productId);
  const cartData = await redisClient.get('cart');
  const cart: TCart = JSON.parse(cartData);

  const isItemInCart = cart.find(entry => entry.item.id === product.id);

  if(!!isItemInCart) {
    const itemIndex = cart.findIndex(entry => entry.item.id === product.id);
    cart.splice(itemIndex, 1);
    await redisClient.set('cart', JSON.stringify(cart));

    return response.status(204).json({});
  }

  // await redisClient.set('key', value, { EX: 10 }); // timer de expiração: 10 segundos

  return response.status(204).json({});
});

app.get('/getCart', ensureRedisConnection, async (request, response) => {
  const cart = await redisClient.get('cart');

  if(!cart) {
    return response.status(200).json({ cart: '[]' });  
  }

  return response.status(200).json({ cart: cart });
});

app.delete('/clearCart', async (request, response) => {
  await redisClient.del('cart');

  return response.status(204).json({});
});

app.get("/stream", ensureRedisConnection, (req, res) => {
  res.setHeader("Content-Type", "text/event-stream"); // SSE format
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const stream = new Readable({
      read() {}
  });

  let counter = 0;
  const interval = setInterval(() => {
      counter++;
      redisClient.get('cart').then((cart) => {
        if(!cart) {
          stream.push(`data: ${JSON.stringify({ cart: [] })}\n\n`);    
        } else {
          stream.push(`data: ${JSON.stringify({ cart: JSON.parse(cart) })}\n\n`);
        }
      })

  }, 1000);

  stream.pipe(res);

  req.on("close", () => {
      clearInterval(interval);
      stream.destroy();
  });
});

app.use((error: Error, request: Request, response: Response, next: NextFunction) => {
  console.log('❗❗❗ error', error);

  return response.status(500).json({
    status: 'error',
    error: 'Internal server error',
  });
})

const bootUp = async () => {
  // await redisClient.connect();

  app.listen(PORT, () => {
    console.log(`🚀 Server started on port ${PORT}`);
  });
}

bootUp();
