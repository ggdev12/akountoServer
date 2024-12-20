const { fromBuffer } = require("pdf2pic");

const convertPDFtoImages = async (file) => {
  let base64Images = [];

  const options = {
    quality: 100,
    density: 100,
    saveFilename: "untitled",
    savePath: "./images",
    format: "JPEG",
    height: 1600,
    preserveAspectRatio: true,
  };

  const convert = fromBuffer(file, options);
  const pagesToConvert = -1; // Convert all pages

  const conversionResults = await convert.bulk(pagesToConvert, {
    responseType: "base64",
  });
  base64Images = conversionResults.map((result) => result.base64);

  return base64Images;
};

module.exports = { convertPDFtoImages };
