# Poster Town Backend

Node.js CRUD API for products, users, and orders. Data is stored in MongoDB, and product images can be uploaded to Cloudinary.

## Setup

Create `.env` from `.env.example`, then run:

```bash
npm.cmd install
npm.cmd run seed
npm.cmd run dev
```

Server runs on `http://localhost:5000` by default.

## Endpoints

- `GET /api/products`
- `GET /api/products/:id`
- `POST /api/products`
- `PUT /api/products/:id`
- `PATCH /api/products/:id`
- `DELETE /api/products/:id`

The same CRUD pattern is available for:

- `/api/users`
- `/api/orders`

## Product Image Upload

Send `multipart/form-data` to `POST /api/products` or `PATCH /api/products/:id`.

- `images`: one or more image files
- `product`: optional JSON string containing the product payload

Uploaded image URLs are stored under `media.featuredImage`, `media.thumbnail`, `media.gallery`, and `media.cloudinary`.

