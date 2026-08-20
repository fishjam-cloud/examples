import {
  usePeers,
  useVAD,
  type PeerId,
} from '@fishjam-cloud/react-native-client';
import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { TextColors } from '../theme/colors';
import { useUser } from '../user/UserContext';
import { Avatar } from './Avatar';

type PeerMeta = { displayName?: string };

type AudioCallViewProps = {
  calleeName: string;
};

/** Who is on the audio call, with a speaking indicator per peer. */
export function AudioCallView({ calleeName }: AudioCallViewProps) {
  const { avatarUrlFor } = useUser();
  const { remotePeers } = usePeers<PeerMeta>();

  const peerIdKey = JSON.stringify(remotePeers.map((peer) => peer.id));
  const peerIds = useMemo(() => JSON.parse(peerIdKey) as PeerId[], [peerIdKey]);
  const speaking = useVAD({ peerIds });

  if (remotePeers.length === 0) {
    return (
      <View style={styles.callee}>
        <Avatar
          name={calleeName}
          avatarUrl={avatarUrlFor(calleeName)}
          size={120}
        />
        <Text style={styles.name}>{calleeName}</Text>
      </View>
    );
  }

  return (
    <View style={styles.roster}>
      {remotePeers.map((peer) => {
        const name = peer.metadata?.peer?.displayName ?? calleeName;
        return (
          <View key={peer.id} style={styles.rosterItem}>
            <Avatar
              name={name}
              avatarUrl={avatarUrlFor(name)}
              size={88}
              speaking={speaking[peer.id] ?? false}
            />
            <Text style={styles.rosterName}>{name}</Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  callee: { alignItems: 'center', gap: 16, marginTop: 8 },
  name: { fontSize: 28, fontWeight: '700', color: TextColors.darkText },
  roster: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 24,
    marginTop: 8,
  },
  rosterItem: { alignItems: 'center', gap: 8 },
  rosterName: { fontSize: 14, color: TextColors.darkText, fontWeight: '500' },
});
