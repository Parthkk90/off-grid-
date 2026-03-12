// Settlement Service — Deferred on-chain transaction submission
// This service is OPTIONAL — the core app works 100% offline without it.
// When a device eventually gets internet, this submits queued transfer intents
// as proper ERC-20 transactions on the Celo blockchain.

import {ethers} from 'ethers';
import {TransactionStatus} from '../../types/transaction';
import {
  DEFAULT_RPC_URL,
  DEFAULT_CHAIN_ID,
  CHAIN_NAME,
  DEFAULT_TOKEN_DECIMALS,
  GAS_LIMIT_ERC20_TRANSFER,
  MAX_FEE_PER_GAS_GWEI,
  MAX_PRIORITY_FEE_GWEI,
} from '../../utils/constants';
import {store} from '../../store';
import {updateTransactionStatus} from '../../store/transactionSlice';
import {markSettled} from '../../store/ledgerSlice';
import WalletService from '../wallet/WalletService';
import {LedgerEntry} from '../../store/ledgerSlice';
import LocalLedger from '../ledger/LocalLedger';

// How often to try settling when online
const SETTLEMENT_INTERVAL_MS = 30000; // 30 seconds
const MAX_BATCH_SIZE = 10;

class SettlementService {
  private static instance: SettlementService;
  private provider: ethers.JsonRpcProvider | null = null;
  private walletService: WalletService;
  private localLedger: LocalLedger;
  private processTimer: ReturnType<typeof setInterval> | null = null;
  private isProcessing: boolean = false;
  private isRunning: boolean = false;

  private constructor() {
    this.walletService = WalletService.getInstance();
    this.localLedger = LocalLedger.getInstance();
  }

  static getInstance(): SettlementService {
    if (!SettlementService.instance) {
      SettlementService.instance = new SettlementService();
    }
    return SettlementService.instance;
  }

  /**
   * Start the settlement loop (only call when internet becomes available)
   */
  start(rpcUrl: string = DEFAULT_RPC_URL): void {
    if (this.isRunning) return;

    this.provider = new ethers.JsonRpcProvider(rpcUrl, {
      chainId: DEFAULT_CHAIN_ID,
      name: CHAIN_NAME,
    });
    this.isRunning = true;

    // Try to settle immediately
    this.processSettlement();

    // Set up periodic settlement
    this.processTimer = setInterval(() => {
      this.processSettlement();
    }, SETTLEMENT_INTERVAL_MS);

    console.log('[SettlementService] Started settlement processing');
  }

  /**
   * Stop the settlement loop
   */
  stop(): void {
    this.isRunning = false;
    if (this.processTimer) {
      clearInterval(this.processTimer);
      this.processTimer = null;
    }
    this.provider = null;
    console.log('[SettlementService] Stopped');
  }

  /**
   * Check if settlement is currently active
   */
  isActive(): boolean {
    return this.isRunning;
  }

  /**
   * Process unsettled transactions — build proper EVM txs and submit on-chain
   */
  async processSettlement(): Promise<void> {
    if (this.isProcessing || !this.provider) return;
    this.isProcessing = true;

    try {
      const unsettled = this.localLedger.getUnsettled();
      // Only settle DEBIT entries (sends) — credits are the counterparty's responsibility
      const debits = unsettled
        .filter(e => e.type === 'DEBIT')
        .slice(0, MAX_BATCH_SIZE);

      for (const entry of debits) {
        try {
          await this.settleOnChain(entry);
        } catch (error: any) {
          console.warn(
            `[SettlementService] Failed to settle ${entry.txId}:`,
            error.message,
          );
        }
      }
    } finally {
      this.isProcessing = false;
    }
  }

  // ─── Private ───

  private async settleOnChain(entry: LedgerEntry): Promise<void> {
    if (!this.provider) return;

    const from = this.walletService.getAddress();
    const nonce = await this.provider.getTransactionCount(from, 'pending');

    // Build proper ERC-20 transfer for on-chain settlement
    const iface = new ethers.Interface([
      'function transfer(address to, uint256 amount)',
    ]);
    const transferData = iface.encodeFunctionData('transfer', [
      entry.to,
      ethers.parseUnits(entry.amount, DEFAULT_TOKEN_DECIMALS),
    ]);

    const txRequest: ethers.TransactionLike = {
      to: entry.tokenAddress,
      data: transferData,
      chainId: DEFAULT_CHAIN_ID,
      nonce,
      gasLimit: GAS_LIMIT_ERC20_TRANSFER,
      maxFeePerGas: ethers.parseUnits(MAX_FEE_PER_GAS_GWEI, 'gwei'),
      maxPriorityFeePerGas: ethers.parseUnits(MAX_PRIORITY_FEE_GWEI, 'gwei'),
      type: 2,
      value: 0n,
    };

    // Sign and submit
    const signedTx = await this.walletService.signTransaction(txRequest);
    const txResponse = await this.provider.broadcastTransaction(signedTx);
    const receipt = await txResponse.wait(1);

    if (receipt && receipt.status === 1) {
      // Mark as settled in both stores
      store.dispatch(markSettled(entry.txId));
      store.dispatch(
        updateTransactionStatus({
          id: entry.txId,
          status: TransactionStatus.SETTLED,
          txHash: receipt.hash,
        }),
      );
      console.log(`[SettlementService] Settled ${entry.txId}: ${receipt.hash}`);
    }
  }
}

export default SettlementService;
