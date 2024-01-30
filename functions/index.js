const {onObjectFinalized} = require("firebase-functions/v2/storage");
const {initializeApp} = require("firebase-admin/app");
const {getStorage} = require("firebase-admin/storage");
const logger = require("firebase-functions/logger");
const axios = require("axios");
const FormData = require("form-data");
const {onRequest} = require("firebase-functions/v2/https");
const {getFirestore} = require("firebase-admin/firestore");
const {setGlobalOptions} = require("firebase-functions/v2");
const express = require("express");
const cors = require("cors");

initializeApp();
setGlobalOptions({region: "asia-northeast3", maxInstances: 10});

exports.sendImgToAWS = onObjectFinalized({cpu: 2}, async (event) => {
  const fileBucket = event.data.bucket; // Storage bucket containing the file.
  const filePath = event.data.name; // File path in the bucket.
  const contentType = event.data.contentType; // File content type.

  // Exit if this is triggered on a file that is not an image.
  if (!contentType.startsWith("image/")) {
    return logger.log("This is not an image.");
  }

  if (!filePath.startsWith("ImgToAWS/")) {
    return logger.log("img should be in ImgToAWS folder !");
  }

  // Download file into memory from bucket.
  const bucket = getStorage().bucket(fileBucket);
  const downloadResponse = await bucket.file(filePath).download();
  const imageBuffer = downloadResponse[0];
  logger.log("Image downloaded!");

  try {
    // Prepare the form data
    const formData = new FormData();
    formData.append("file", imageBuffer, {filename: filePath});

    // Set the headers for the request
    const headers = {
      ...formData.getHeaders(),
      // Add any additional headers needed (e.g., authorization)
    };

    // URL of the external server where you want to upload the file
    const url = process.env.AWS_URL;

    // Post the file using axios
    const response = await axios.post(url, formData, {headers});

    logger.log("Image has been sent!", response.data);
  } catch (error) {
    logger.error("Error sending image:", error);
    throw new Error("Error sending image");
  }
});


// Express setup
const app = express();
app.use(cors({origin: true}));

// POST endpoint to receive JSON
app.post("/", async (req, res) => {
  // Access the JSON sent in the body of the request
  const data = req.body;

  // Process the data (add your logic here)
  // console.log("Received JSON:", data);

  // Send a response
  res.status(200).send("JSON received successfully");

  await getFirestore().collection("ImageResult").add(data);
});

// Export the Cloud Function
exports.receiveImgFromAWS = onRequest({
  region: "asia-northeast3",
  runtimeOptions: {
    // You can specify memory and timeout as per your requirement
    memory: "256MB",
    timeoutSeconds: 60,
  },
}, app);
