const products = require('../../js/product');

exports.handler = async () => {
  return {
    statusCode: 200,
    body: JSON.stringify(products),
    headers: {
      'Content-Type': 'application/json',
    }
  };
};
