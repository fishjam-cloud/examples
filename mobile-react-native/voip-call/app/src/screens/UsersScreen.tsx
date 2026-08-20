import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useEffect, useRef } from 'react';
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar } from '../components';
import { usePlaceCall } from '../hooks/usePlaceCall';
import { AdditionalColors, BrandColors, TextColors } from '../theme/colors';
import { useUser, type UserSummary } from '../user/UserContext';

type UserRowProps = {
  user: UserSummary;
  onCall: (username: string) => void;
};

function UserRow({ user, onCall }: UserRowProps) {
  return (
    <TouchableOpacity
      style={styles.row}
      onPress={() => onCall(user.username)}
      activeOpacity={0.7}>
      <Avatar name={user.username} avatarUrl={user.avatarUrl} size={44} />
      <Text style={styles.name}>{user.username}</Text>
      <MaterialCommunityIcons
        name="phone"
        size={22}
        color={BrandColors.seaBlue100}
      />
    </TouchableOpacity>
  );
}

export function UsersScreen() {
  const { username, users, refreshUsers, logout } = useUser();
  const placeCall = usePlaceCall();

  useEffect(() => {
    refreshUsers();
  }, [refreshUsers]);

  const callInFlight = useRef(false);
  const handleCall = (to: string) => {
    if (callInFlight.current) return;
    callInFlight.current = true;
    placeCall(to)
      .catch((err) => console.error('Failed to start call:', err))
      .finally(() => {
        callInFlight.current = false;
      });
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>Users</Text>
          <TouchableOpacity
            style={styles.logoutButton}
            onPress={() => logout()}
            accessibilityLabel="Log out">
            <MaterialCommunityIcons
              name="logout"
              size={16}
              color={AdditionalColors.red80}
            />
            <Text style={styles.logoutText}>Log out</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.me}>Signed in as {username}</Text>
      </View>

      <FlatList
        data={users}
        keyExtractor={(item) => item.username}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={false}
            onRefresh={refreshUsers}
            tintColor={BrandColors.darkBlue80}
          />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <MaterialCommunityIcons
              name="account-multiple-outline"
              size={48}
              color={BrandColors.darkBlue60}
            />
            <Text style={styles.emptyText}>No other users online yet.</Text>
          </View>
        }
        renderItem={({ item }) => <UserRow user={item} onCall={handleCall} />}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BrandColors.seaBlue20 },
  header: {
    padding: 24,
    paddingBottom: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: { fontSize: 28, fontWeight: '700', color: TextColors.darkText },
  me: { fontSize: 14, color: AdditionalColors.grey80, marginTop: 2 },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 100,
    backgroundColor: AdditionalColors.white,
  },
  logoutText: {
    fontSize: 14,
    fontWeight: '600',
    color: AdditionalColors.red80,
  },
  list: { padding: 16, gap: 10, flexGrow: 1 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 16,
    backgroundColor: AdditionalColors.white,
    gap: 12,
  },
  name: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
    color: TextColors.darkText,
  },
  empty: { paddingTop: 64, alignItems: 'center', gap: 10 },
  emptyText: { fontSize: 16, fontWeight: '600', color: BrandColors.darkBlue80 },
});
