import { v2 as cloudinary } from "cloudinary";

let configured = false;

export function configureCloudinary() {
  const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } = process.env;

  if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
    return false;
  }

  cloudinary.config({
    cloud_name: CLOUDINARY_CLOUD_NAME,
    api_key: CLOUDINARY_API_KEY,
    api_secret: CLOUDINARY_API_SECRET
  });
  configured = true;
  return true;
}

// Every upload is stored as WebP. "auto:good" lets Cloudinary pick the lowest
// quality that still looks the same, per image: in testing a 1.7 MB 4K JPEG came
// out at 639 KB and a 338 KB poster at 224 KB, at full resolution.
const UPLOAD_OPTIONS = {
  resource_type: "image",
  format: "webp",
  transformation: [{ quality: "auto:good" }]
};

export function uploadImageBuffer(buffer, folder = "postertown/products") {
  if (!configured && !configureCloudinary()) {
    throw new Error("Cloudinary credentials are required to upload images");
  }

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { ...UPLOAD_OPTIONS, folder },
      (error, result) => {
        if (error) {
          reject(error);
          return;
        }

        resolve(result);
      }
    );

    stream.end(buffer);
  });
}
