import { connectToDB } from './_db';
import formidable from 'formidable';
import fs from 'fs';

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  if (req.method === 'POST') {
    await connectToDB();
    const form = formidable({ multiples: false });

    form.parse(req, (err, fields, files) => {
      if (err) return res.status(500).json({ error: 'File error' });

      // Do your Excel parsing, Mongo insert logic here
      res.status(200).json({ message: 'Uploaded!' });
    });
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}
