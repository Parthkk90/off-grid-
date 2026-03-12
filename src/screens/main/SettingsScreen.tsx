// Settings Screen — App configuration and settlement controls

import React from 'react';
import {View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useSelector} from 'react-redux';
import {Colors} from '../../theme/colors';
import {selectWalletAddress} from '../../store/walletSlice';
import {selectPendingSettlement} from '../../store/ledgerSlice';
import {selectConnectedCount} from '../../store/meshSlice';
import {CHAIN_NAME, BLOCK_EXPLORER_URL, FAUCET_URL} from '../../utils/constants';
import {formatAddress} from '../../utils/helpers';
import SettlementServiceFactory from '../../services/settlement/SettlementServiceFactory';

export default function SettingsScreen(): React.ReactElement {
  const address = useSelector(selectWalletAddress);
  const pendingSettlement = useSelector(selectPendingSettlement);
  const connectedPeers = useSelector(selectConnectedCount);

  const handleManualSync = async () => {
    try {
      const factory = SettlementServiceFactory.getInstance();
      await factory.triggerManualSettlement();
      Alert.alert('Settlement', 'Checking for internet connectivity…');
    } catch (err: any) {
      Alert.alert('Settlement Failed', err.message);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <Text style={styles.header}>Settings</Text>

        {/* Wallet section */}
        <Text style={styles.sectionLabel}>WALLET</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Address</Text>
            <Text style={styles.rowValue}>{formatAddress(address, 6)}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Network</Text>
            <Text style={styles.rowValue}>{CHAIN_NAME}</Text>
          </View>
        </View>

        {/* Mesh section */}
        <Text style={styles.sectionLabel}>MESH NETWORK</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Connected Peers</Text>
            <Text style={styles.rowValue}>{connectedPeers}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Transport</Text>
            <Text style={styles.rowValue}>BLE 5.0</Text>
          </View>
        </View>

        {/* Settlement section */}
        <Text style={styles.sectionLabel}>ON-CHAIN SETTLEMENT</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Unsettled Txns</Text>
            <View style={styles.badgeRow}>
              <Text style={styles.rowValue}>{pendingSettlement.length}</Text>
              {pendingSettlement.length > 0 && (
                <View style={styles.pendingBadge}>
                  <Text style={styles.pendingText}>PENDING</Text>
                </View>
              )}
            </View>
          </View>
          <View style={styles.divider} />
          <TouchableOpacity style={styles.row} onPress={handleManualSync}>
            <Text style={styles.rowLabel}>Sync Now</Text>
            <Text style={styles.linkText}>Try Settlement →</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.settleHint}>
          Settlement submits your offline transactions to the Celo blockchain
          when internet is available. Your payments work without it.
        </Text>

        {/* About section */}
        <Text style={styles.sectionLabel}>ABOUT</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Version</Text>
            <Text style={styles.rowValue}>1.0.0</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Architecture</Text>
            <Text style={styles.rowValue}>100% Offline Mesh</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: Colors.bgDark, paddingHorizontal: 20},
  header: {color: Colors.textPrimary, fontSize: 20, fontWeight: '700', paddingTop: 8, marginBottom: 24},
  sectionLabel: {
    color: Colors.textMuted, fontSize: 11, letterSpacing: 1.5,
    marginBottom: 8, marginTop: 16,
  },
  card: {backgroundColor: Colors.bgCard, borderRadius: 12, overflow: 'hidden'},
  row: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', padding: 14,
  },
  rowLabel: {color: Colors.textPrimary, fontSize: 14},
  rowValue: {color: Colors.textMuted, fontSize: 14},
  badgeRow: {flexDirection: 'row', alignItems: 'center', gap: 8},
  pendingBadge: {
    backgroundColor: 'rgba(245,166,35,0.2)', borderRadius: 4,
    paddingHorizontal: 6, paddingVertical: 2,
  },
  pendingText: {color: Colors.pending, fontSize: 9, fontWeight: '700'},
  linkText: {color: Colors.accent, fontSize: 14, fontWeight: '500'},
  divider: {height: 1, backgroundColor: Colors.border, marginHorizontal: 14},
  settleHint: {
    color: Colors.textMuted, fontSize: 12, lineHeight: 18,
    marginTop: 8, marginBottom: 8,
  },
});
