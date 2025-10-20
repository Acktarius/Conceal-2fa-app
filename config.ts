import { getRuntimeConfig, logConfigInfo } from './config/runtime';
import { getGlobalWorkletLogging } from './services/interfaces/IWorkletLogging';

// Get runtime configuration
const runtimeConfig = getRuntimeConfig();

export const config = {
  debug: runtimeConfig.debugMode,
  apiUrl: ['https://ccxapi.conceal.network/api/'],
  nodeList: ['https://explorer.conceal.network/daemon/', 'https://ccxapi.conceal.network/daemon/'],
  publicNodes: 'https://explorer.conceal.network/pool',
  mainnetExplorerUrl: 'https://explorer.conceal.network/',
  mainnetExplorerUrlHash: 'https://explorer.conceal.network/index.html?hash={ID}#blockchain_transaction',
  mainnetExplorerUrlBlock: 'https://explorer.conceal.network/index.html?hash={ID}#blockchain_block',
  testnetExplorerUrl: 'https://explorer.testnet.conceal.network/',
  testnetExplorerUrlHash: 'https://explorer.testnet.conceal.network/index.html?hash={ID}#blockchain_transaction',
  testnetExplorerUrlBlock: 'https://explorer.testnet.conceal.network/index.html?hash={ID}#blockchain_block',
  testnet: false,
  coinUnitPlaces: runtimeConfig.conceal.coinUnitPlaces,
  coinFee: new JSBigInt('1000'),
  remoteNodeFee: new JSBigInt('10000'),
  donationAddress: 'ccx7V4LeUXy2eZ9waDXgsLS7Uc11e2CpNSCWVdxEqSRFAm6P6NQhSb7XMG1D6VAZKmJeaJP37WYQg84zbNrPduTX2whZ5pacfj',
  optimizeOutputs: 100,
  optimizeThreshold: 100,
  minimumFee_V2: new JSBigInt('1000'),
  fusionTxMinInOutCountRatio: 4,
  maxFusionOutputs: 8,
  messageTxAmount: new JSBigInt(runtimeConfig.conceal.messageTxAmount),
  maxMessageSize: 260,
  txMinConfirms: 10,
  txCoinbaseMinConfirms: 10,
  coinSymbol: 'CCX',
  coinSymbolShort: '₡',
  openAliasPrefix: 'ccx',
  coinName: 'Conceal',
  coinUriPrefix: 'conceal:',
  addressPrefix: 0x7ad4,
  integratedAddressPrefix: 0x7ad5,
  addressPrefixTestnet: 0x7ad4,
  integratedAddressPrefixTestnet: 0x7ad5,
  subAddressPrefix: 0x7ad6,
  subAddressPrefixTestnet: 0x7ad6,
  feePerKB: new JSBigInt('1000'),
  dustThreshold: new JSBigInt('10'),
  defaultMixin: runtimeConfig.conceal.defaultMixin,
  txChargeAddress: '',
  idleTimeout: 30,
  idleWarningDuration: 20,
  syncBlockCount: 300,
  maxBlockQueue: 10,
  maxRemoteNodes: 8,
  maxWorkerCores: 8,
  maxBlockNumber: 500000000,
  avgBlockTime: 120,
  cryptonoteMemPoolTxLifetime: 60 * 60 * 12,
  depositMinAmountCoin: 1,
  depositMinTermMonth: 1,
  depositMinTermBlock: 21900,
  depositMaxTermMonth: 12,
  depositRateV3: [0.029, 0.039, 0.049],
  UPGRADE_HEIGHT_V4: 45000,
  PRETTY_AMOUNTS: [
    1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 200, 300, 400, 500, 600, 700, 800, 900, 1000,
    2000, 3000, 4000, 5000, 6000, 7000, 8000, 9000, 10000, 20000, 30000, 40000, 50000, 60000, 70000, 80000, 90000,
    100000, 200000, 300000, 400000, 500000, 600000, 700000, 800000, 900000, 1000000, 2000000, 3000000, 4000000, 5000000,
    6000000, 7000000, 8000000, 9000000, 10000000, 20000000, 30000000, 40000000, 50000000, 60000000, 70000000, 80000000,
    90000000, 100000000, 200000000, 300000000, 400000000, 500000000, 600000000, 700000000, 800000000, 900000000,
    1000000000, 2000000000, 3000000000, 4000000000, 5000000000, 6000000000, 7000000000, 8000000000, 9000000000,
    10000000000, 20000000000, 30000000000, 40000000000, 50000000000, 60000000000, 70000000000, 80000000000, 90000000000,
    100000000000, 200000000000, 300000000000, 400000000000, 500000000000, 600000000000, 700000000000, 800000000000,
    900000000000, 1000000000000, 2000000000000, 3000000000000, 4000000000000, 5000000000000, 6000000000000,
    7000000000000, 8000000000000, 9000000000000, 10000000000000, 20000000000000, 30000000000000, 40000000000000,
    50000000000000, 60000000000000, 70000000000000, 80000000000000, 90000000000000, 100000000000000, 200000000000000,
    300000000000000, 400000000000000, 500000000000000, 600000000000000, 700000000000000, 800000000000000,
    900000000000000, 1000000000000000, 2000000000000000, 3000000000000000, 4000000000000000, 5000000000000000,
    6000000000000000, 7000000000000000, 8000000000000000, 9000000000000000, 10000000000000000, 20000000000000000,
    30000000000000000, 40000000000000000, 50000000000000000, 60000000000000000, 70000000000000000, 80000000000000000,
    90000000000000000, 100000000000000000, 200000000000000000, 300000000000000000, 400000000000000000,
    500000000000000000, 600000000000000000, 700000000000000000, 800000000000000000, 900000000000000000,
    1000000000000000000, 2000000000000000000, 3000000000000000000, 4000000000000000000, 5000000000000000000,
    6000000000000000000, 7000000000000000000, 8000000000000000000, 9000000000000000000, 10000000000000000000,
  ],
};

// Function to log debug messages using worklet logging
export function logDebugMsg(...data: any[]) {
  if (config.debug) {
    if (data.length > 1) {
      getGlobalWorkletLogging().logging2string(data[0].toString(), data.slice(1).toString());
      //console.log(data[0], data.slice(1));
    } else {
      getGlobalWorkletLogging().logging1string(data[0].toString());
      //console.log(data[0]);
    }
  }
}

// Log configuration info on startup (only in debug mode)
logConfigInfo();
