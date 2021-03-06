import { join } from 'path';
import { Agent } from 'https';
import { Stream } from 'stream';
import { platform, tmpdir } from 'os';
import { createWriteStream } from 'fs';
import { log } from './log';
import { axios, FormData } from '../external';

const os = platform();

function getMessage(body: string) {
  if (body) {
    try {
      const content = JSON.parse(body);
      return content.message;
    } catch (ex) {
      return body;
    }
  }

  return '';
}

function streamToFile(source: Stream, target: string) {
  const dest = createWriteStream(target);
  return new Promise<Array<string>>((resolve, reject) => {
    source.pipe(dest);
    source.on('error', err => reject(err));
    dest.on('finish', () => resolve([target]));
  });
}

export function downloadFile(target: string): Promise<Array<string>> {
  return axios.default
    .get<Stream>(target, {
      responseType: 'stream',
      headers: {
        'user-agent': `piral-cli/http.node-${os}`,
      },
    })
    .then(res => {
      const rid = Math.random().toString(36).split('.').pop();
      const target = join(tmpdir(), `pilet_${rid}.tgz`);
      log('generalDebug_0003', `Writing the downloaded file to "${target}".`);
      return streamToFile(res.data, target);
    })
    .catch(error => {
      log('failedHttpGet_0068', error.message);
      return [];
    });
}

export function postFile(target: string, key: string, file: Buffer, ca?: Buffer): Promise<object | boolean> {
  const form = new FormData();
  const httpsAgent = ca ? new Agent({ ca }) : undefined;
  form.append('file', file, 'pilet.tgz');
  return axios.default
    .post(target, form, {
      headers: {
        ...form.getHeaders(),
        authorization: `Basic ${key}`,
        'user-agent': `piral-cli/http.node-${os}`,
      },
      httpsAgent,
    })
    .then(
      res => res.data || true,
      error => {
        if (error.response) {
          // The request was made and the server responded with a status code
          // that falls out of the range of 2xx
          const { data, statusText, status } = error.response;
          const message = getMessage(data);
          log('unsuccessfulHttpPost_0066', statusText, status, message || '');
        } else if (error.request) {
          // The request was made but no response was received
          // `error.request` is an instance of XMLHttpRequest in the browser and an instance of
          // http.ClientRequest in node.js
          log('failedHttpPost_0065', error.request);
        } else {
          // Something happened in setting up the request that triggered an Error
          log('failedHttpPost_0065', error.message);
        }

        return false;
      },
    );
}
