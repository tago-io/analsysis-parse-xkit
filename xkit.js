const Analysis = require('tago/analysis');
const Device   = require('tago/device');
const Utils    = require('tago/utils');
const co       = require('co');
const Account  = require('tago/account');

/** Get token of a device id by it's name
 * @param  {Class|Object} account
 * @param  {string} device_id
 * @param  {string} name
 */
function getTokenByName(account, device_id, names) {
  return new Promise((resolve, reject) => {
    co(function* () {
      const tokens = yield account.devices.tokenList(device_id);
      if (!tokens || !tokens[0]) return resolve();
      let token;

      if (names) {
        names = Array.isArray(names) ? names : [names];
        names.forEach((name) => {
          if (token) return;
          token = tokens.find(token => token.name.indexOf(name) >= 0);
        });
      } else {
        token = tokens[0];
      }

      if (!token) return reject(`Can\'t be found token to ${device_id} with filter by ${names}`);
      resolve(token.token);
    }).catch(reject);
  });
}

function convert_hex2dec(num) {
  return parseInt(num, 16).toString(10);
}

function extract_number(message, high, low) {
  const hex = `${message[low]}${message[high]}`; // value low and high is inverted

  return convert_hex2dec(hex);
}

function extract_number_1Byte(message, low) {
  const hex = `${message[low]}`;

  return convert_hex2dec(hex);
}

function parse(context, scope) {
  const env_var = Utils.env_to_obj(context.environment);
  if (!env_var.acc_token) return context.log('Cant\'be found parameter acc_token on environment variables');
  context.log('Parse started!');

  const data = !scope[0] ? null : scope.find(x => x.variable === 'data');
  data.value = String(data.value);

  if (!data) return;

  const message_leng = 12 * 2;
  const bytes = [];
  for (let i = 0; i < message_leng; i += 2) {
    bytes.push(`${data.value[i]}${data.value[i + 1]}`);
  }

  const temp = extract_number(bytes, 0, 1) / 100;
  const pressure = extract_number_1Byte(bytes, 2, 3) * 3;
  const photo = extract_number_1Byte(bytes, 4, 5) / 1000;
  const x_acc = extract_number_1Byte(bytes, 6, 7) / 250;
  const y_acc = extract_number_1Byte(bytes, 8, 9) / 250;
  const z_acc = extract_number_1Byte(bytes, 10, 11) / 250;

  co(function* () {
    const myaccount = new Account(env_var.acc_token);

    const device_token = yield getTokenByName(myaccount, data.origin, ['generic', 'parse', 'Default', 'Token #1', 'Token #2', 'SmartCare']);
    if (!device_token) return context.log(`Token can\`t be found to origin: ${data.origin}`);
    const mydevice = new Device(device_token);
    yield mydevice.insert([{
      variable: 'temperature',
      value: temp,
      serie: data.serie,
      time: data.time,
      unit: 'ºC'
    }, {
      variable: 'pressure',
      value: pressure,
      serie: data.serie,
      time: data.time,
      unit: 'Pa'
    }, {
      variable: 'photo',
      value: photo,
      serie: data.serie,
      time: data.time,
      unit: 'V'
    }, {
      variable: 'x_acc',
      value: x_acc,
      serie: data.serie,
      time: data.time,
      unit: 'g'
    }, {
      variable: 'y_acc',
      value: y_acc,
      serie: data.serie,
      time: data.time,
      unit: 'g'
    },{
      variable: 'z_acc',
      value: z_acc,
      serie: data.serie,
      time: data.time,
      unit: 'g'
    }]).then(context.log);
  }).catch(context.log);
}

module.exports = new Analysis(parse, 'YOUR_ANALYSIS_TOKEN_HERE');
