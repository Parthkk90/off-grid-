// Constants for Offgrid Pay

// ─── Celo Alfajores Testnet Configuration ───
export const DEFAULT_CHAIN_ID = 44787; // Celo Alfajores testnet
export const DEFAULT_RPC_URL = 'https://alfajores-forno.celo-testnet.org';
export const CHAIN_NAME = 'Celo Alfajores Testnet';
export const BLOCK_EXPLORER_URL = 'https://alfajores.celoscan.io';
export const FAUCET_URL = 'https://faucet.celo.org/alfajores';

// ─── Token Configuration ───
// USDC on Celo Alfajores (Circle's official deployment)
export const USDC_TOKEN_ADDRESS = '0x2F25deB3848C207fc8E0c34035B3Ba7fC157602B';
export const USDC_TOKEN_SYMBOL = 'USDC';
export const USDC_TOKEN_DECIMALS = 6;

// cUSD on Celo Alfajores (Celo's native stablecoin — can also pay gas fees)
export const CUSD_TOKEN_ADDRESS = '0x874069Fa1Eb16D44d622F2e0Ca25eeA172369bC1';
export const CUSD_TOKEN_SYMBOL = 'cUSD';
export const CUSD_TOKEN_DECIMALS = 18;

// Default token for the app
export const DEFAULT_TOKEN_ADDRESS = USDC_TOKEN_ADDRESS;
export const DEFAULT_TOKEN_SYMBOL = USDC_TOKEN_SYMBOL;
export const DEFAULT_TOKEN_DECIMALS = USDC_TOKEN_DECIMALS;

// ERC-20 Transfer function selector
export const ERC20_TRANSFER_SELECTOR = '0xa9059cbb';

// ─── Gas Configuration (Celo Alfajores) ───
// Celo gas prices are much lower than Ethereum mainnet
export const GAS_LIMIT_ERC20_TRANSFER = 65000n; // sufficient for USDC/cUSD transfer
export const MAX_FEE_PER_GAS_GWEI = '5';         // 5 gwei on Celo Alfajores
export const MAX_PRIORITY_FEE_GWEI = '1';         // 1 gwei tip

// ─── Gossip Protocol ───
export const DEFAULT_TTL = 7;            // max hops before message dies
export const MAX_SEEN_TX_CACHE = 1000;   // max entries in dedup cache
export const GOSSIP_RATE_LIMIT_MS = 100; // min time between forwards

// ─── Mesh Networking ───
export const MAX_PEERS = 10;
export const MIN_RSSI_THRESHOLD = -80;   // dBm, reject weaker signals
export const BATTERY_LOW_THRESHOLD = 20; // percent

// ─── Storage Keys ───
export const KEYCHAIN_SERVICE = 'offgrid-pay-wallet';
export const KEYCHAIN_PRIVATE_KEY = 'private-key';
export const KEYCHAIN_MNEMONIC = 'mnemonic';
export const STORAGE_WALLET_ADDRESS = 'wallet-address';
export const STORAGE_NONCE = 'local-nonce';
