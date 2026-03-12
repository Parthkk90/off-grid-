// Wallet Service — HD wallet creation, import, and transaction signing

import {ethers} from 'ethers';
import {WalletCreationResult, WalletImportResult} from '../../types/wallet';
import {WalletCreationError, WalletImportError} from '../../utils/errors';
import SecureStorageService from './SecureStorageService';

class WalletService {
  private static instance: WalletService;
  private secureStorage: SecureStorageService;
  private wallet: ethers.HDNodeWallet | null = null;

  private constructor() {
    this.secureStorage = SecureStorageService.getInstance();
  }

  static getInstance(): WalletService {
    if (!WalletService.instance) {
      WalletService.instance = new WalletService();
    }
    return WalletService.instance;
  }

  /**
   * Create a new HD wallet from a random mnemonic
   */
  async createWallet(): Promise<WalletCreationResult> {
    try {
      // Generate random mnemonic
      const mnemonic = ethers.Mnemonic.entropyToPhrase(
        ethers.randomBytes(16),
      );

      // Derive wallet from mnemonic
      const hdWallet = ethers.HDNodeWallet.fromMnemonic(
        ethers.Mnemonic.fromPhrase(mnemonic),
      );

      this.wallet = hdWallet;

      // Store securely
      await this.secureStorage.storePrivateKey(hdWallet.privateKey);
      await this.secureStorage.storeMnemonic(mnemonic);
      await this.secureStorage.storeAddress(hdWallet.address);

      return {
        address: hdWallet.address,
        mnemonic,
        privateKey: hdWallet.privateKey,
      };
    } catch (error: any) {
      throw new WalletCreationError(
        `Failed to create wallet: ${error.message}`,
      );
    }
  }

  /**
   * Import wallet from mnemonic phrase
   */
  async importWallet(mnemonic: string): Promise<WalletImportResult> {
    try {
      // Validate mnemonic
      if (!ethers.Mnemonic.isValidMnemonic(mnemonic.trim())) {
        throw new Error('Invalid mnemonic phrase');
      }

      const hdWallet = ethers.HDNodeWallet.fromMnemonic(
        ethers.Mnemonic.fromPhrase(mnemonic.trim()),
      );

      this.wallet = hdWallet;

      // Store securely
      await this.secureStorage.storePrivateKey(hdWallet.privateKey);
      await this.secureStorage.storeMnemonic(mnemonic.trim());
      await this.secureStorage.storeAddress(hdWallet.address);

      return {
        address: hdWallet.address,
        privateKey: hdWallet.privateKey,
      };
    } catch (error: any) {
      if (error instanceof WalletImportError) throw error;
      throw new WalletImportError(
        `Failed to import wallet: ${error.message}`,
      );
    }
  }

  /**
   * Load existing wallet from secure storage
   */
  async loadWallet(): Promise<string | null> {
    try {
      const privateKey = await this.secureStorage.getPrivateKey();
      if (!privateKey) return null;

      this.wallet = new ethers.Wallet(privateKey) as unknown as ethers.HDNodeWallet;
      return this.wallet.address;
    } catch {
      return null;
    }
  }

  /**
   * Get the wallet address
   */
  getAddress(): string {
    if (!this.wallet) throw new Error('Wallet not loaded');
    return this.wallet.address;
  }

  /**
   * Sign a raw transaction
   */
  async signTransaction(
    transaction: ethers.TransactionLike,
  ): Promise<string> {
    if (!this.wallet) throw new Error('Wallet not loaded');

    try {
      const signedTx = await this.wallet.signTransaction(transaction);
      return signedTx;
    } catch (error: any) {
      throw new Error(`Signing failed: ${error.message}`);
    }
  }

  /**
   * Sign arbitrary data (for message signing)
   */
  async signMessage(message: string): Promise<string> {
    if (!this.wallet) throw new Error('Wallet not loaded');
    return await this.wallet.signMessage(message);
  }

  /**
   * Get the mnemonic (for backup display)
   */
  async getMnemonic(): Promise<string | null> {
    return await this.secureStorage.getMnemonic();
  }

  /**
   * Check if wallet exists in storage
   */
  async hasWallet(): Promise<boolean> {
    const address = await this.secureStorage.getAddress();
    return !!address;
  }

  /**
   * Clear wallet data (dangerous!)
   */
  async clearWallet(): Promise<void> {
    this.wallet = null;
    await this.secureStorage.clearAll();
  }
}

export default WalletService;
