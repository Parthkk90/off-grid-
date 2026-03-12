import WalletService from '../services/wallet/WalletService';
import SecureStorageService from '../services/wallet/SecureStorageService';
import {ethers} from 'ethers';

// moduleNameMapper in package.json points react-native-keychain → our mock
const KeychainMock = require('react-native-keychain') as {
  __clearStorage: () => void;
  setGenericPassword: jest.Mock;
  getGenericPassword: jest.Mock;
  resetGenericPassword: jest.Mock;
};

beforeEach(() => {
  // Reset singletons + in-memory keychain storage between tests
  (WalletService as any).instance = undefined;
  (SecureStorageService as any).instance = undefined;
  KeychainMock.__clearStorage();
  jest.clearAllMocks();
});

describe('WalletService', () => {
  // ─── Singleton ─────────────────────────────────────────────────

  it('getInstance always returns the same instance', () => {
    const a = WalletService.getInstance();
    const b = WalletService.getInstance();
    expect(a).toBe(b);
  });

  // ─── createWallet ──────────────────────────────────────────────

  it('createWallet returns a valid Ethereum address', async () => {
    const svc = WalletService.getInstance();
    const result = await svc.createWallet();
    expect(result.address).toMatch(/^0x[0-9a-fA-F]{40}$/);
  });

  it('createWallet returns a 12 or 24 word mnemonic', async () => {
    const svc = WalletService.getInstance();
    const result = await svc.createWallet();
    const wordCount = result.mnemonic.trim().split(/\s+/).length;
    expect([12, 24]).toContain(wordCount);
  });

  it('createWallet mnemonic is valid BIP-39', async () => {
    const svc = WalletService.getInstance();
    const result = await svc.createWallet();
    expect(ethers.Mnemonic.isValidMnemonic(result.mnemonic)).toBe(true);
  });

  it('createWallet derives consistent address from the returned mnemonic', async () => {
    const svc = WalletService.getInstance();
    const result = await svc.createWallet();

    // Re-derive address from mnemonic — must match
    const derived = ethers.HDNodeWallet.fromMnemonic(
      ethers.Mnemonic.fromPhrase(result.mnemonic),
    );
    expect(derived.address).toBe(result.address);
  });

  it('createWallet stores credentials in keychain', async () => {
    const svc = WalletService.getInstance();
    await svc.createWallet();
    // setGenericPassword is called 3 times: private key, mnemonic, address
    expect(KeychainMock.setGenericPassword).toHaveBeenCalledTimes(3);
  });

  it('different wallets have different addresses', async () => {
    const svc1 = WalletService.getInstance();
    const r1 = await svc1.createWallet();

    // Reset and get a fresh wallet
    (WalletService as any).instance = undefined;
    (SecureStorageService as any).instance = undefined;
    KeychainMock.__clearStorage();
    const svc2 = WalletService.getInstance();
    const r2 = await svc2.createWallet();

    expect(r1.address).not.toBe(r2.address);
  });

  // ─── importWallet ──────────────────────────────────────────────

  // BIP-39 test mnemonic (never use with real funds)
  const TEST_MNEMONIC =
    'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
  const EXPECTED_ADDRESS = '0x9858EfFD232B4033E47d90003D41EC34EcaEda94';

  it('importWallet recovers the correct address from a known mnemonic', async () => {
    const svc = WalletService.getInstance();
    const result = await svc.importWallet(TEST_MNEMONIC);
    expect(result.address.toLowerCase()).toBe(EXPECTED_ADDRESS.toLowerCase());
  });

  it('importWallet trims whitespace from mnemonic', async () => {
    const svc = WalletService.getInstance();
    const result = await svc.importWallet(`  ${TEST_MNEMONIC}  `);
    expect(result.address.toLowerCase()).toBe(EXPECTED_ADDRESS.toLowerCase());
  });

  it('importWallet throws WalletImportError on invalid mnemonic', async () => {
    const svc = WalletService.getInstance();
    await expect(
      svc.importWallet('these are not valid mnemonic words at all here'),
    ).rejects.toThrow();
  });

  it('importWallet is idempotent — same mnemonic gives same address', async () => {
    const svc = WalletService.getInstance();
    const r1 = await svc.importWallet(TEST_MNEMONIC);

    (WalletService as any).instance = undefined;
    (SecureStorageService as any).instance = undefined;
    KeychainMock.__clearStorage();

    const svc2 = WalletService.getInstance();
    const r2 = await svc2.importWallet(TEST_MNEMONIC);

    expect(r1.address).toBe(r2.address);
  });

  // ─── loadWallet ────────────────────────────────────────────────

  it('loadWallet returns null when no wallet is stored', async () => {
    const svc = WalletService.getInstance();
    const address = await svc.loadWallet();
    expect(address).toBeNull();
  });

  it('loadWallet rehydrates wallet from stored private key', async () => {
    const svc = WalletService.getInstance();
    const created = await svc.createWallet();

    // Simulate app restart: fresh singleton but keychain still has the key
    (WalletService as any).instance = undefined;
    (SecureStorageService as any).instance = undefined;
    // NOTE: intentionally do NOT clear KeychainMock storage this time

    const freshSvc = WalletService.getInstance();
    const loadedAddress = await freshSvc.loadWallet();
    expect(loadedAddress).toBe(created.address);
  });

  // ─── getAddress ────────────────────────────────────────────────

  it('getAddress returns correct address after createWallet', async () => {
    const svc = WalletService.getInstance();
    const result = await svc.createWallet();
    expect(svc.getAddress()).toBe(result.address);
  });

  it('getAddress throws if wallet not loaded', () => {
    const svc = WalletService.getInstance();
    expect(() => svc.getAddress()).toThrow();
  });

  // ─── signMessage ───────────────────────────────────────────────

  it('signMessage produces a valid ECDSA signature', async () => {
    const svc = WalletService.getInstance();
    await svc.createWallet();
    const sig = await svc.signMessage('test payload');
    expect(sig).toMatch(/^0x[0-9a-fA-F]+$/);
  });

  it('signMessage signature can be verified back to the wallet address', async () => {
    const svc = WalletService.getInstance();
    const {address} = await svc.createWallet();
    const message = 'offgrid transfer intent';
    const sig = await svc.signMessage(message);
    const recovered = ethers.verifyMessage(message, sig);
    expect(recovered).toBe(address);
  });

  it('signMessage throws if called before wallet is created/loaded', async () => {
    const svc = WalletService.getInstance();
    await expect(svc.signMessage('payload')).rejects.toThrow();
  });

  // ─── hasWallet ─────────────────────────────────────────────────

  it('hasWallet returns false when no wallet stored', async () => {
    const svc = WalletService.getInstance();
    expect(await svc.hasWallet()).toBe(false);
  });

  it('hasWallet returns true after createWallet', async () => {
    const svc = WalletService.getInstance();
    await svc.createWallet();
    expect(await svc.hasWallet()).toBe(true);
  });

  // ─── getMnemonic ───────────────────────────────────────────────

  it('getMnemonic returns the stored mnemonic', async () => {
    const svc = WalletService.getInstance();
    const {mnemonic} = await svc.createWallet();
    const stored = await svc.getMnemonic();
    expect(stored).toBe(mnemonic);
  });
});
