import React, { useEffect } from 'react';
import { View, Text, Button, StyleSheet, Alert } from 'react-native';
import { RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../App';
import { Buffer } from 'buffer';
import { DISCOVERY_PORT, useSocket } from '../providers/SocketProvider';

type Props = {
  route: RouteProp<RootStackParamList, 'ConnectionRequest'>;
  navigation: StackNavigationProp<RootStackParamList, 'ConnectionRequest'>;
};

const ConnectionRequestScreen: React.FC<Props> = ({ route, navigation }) => {
  const { deviceIP, deviceName: targetDeviceName, myIP } = route.params;
  const { socket, deviceName } = useSocket();

  useEffect(() => {
    // Define message handler
    const handleMessage = (msg: Buffer, rinfo: any) => {
      if (rinfo.address !== deviceIP) return;
      
      try {
        const data = JSON.parse(msg.toString());
        if (data.type === 'CONNECTION_RESPONSE') {
          if (data.accepted) {
            // Navigate to message screen if accepted
            navigation.replace('Message', { deviceIP, myIP });
          } else {
            Alert.alert(
              'Connection Declined',
              `${targetDeviceName} declined your connection request.`,
              [{ text: 'OK', onPress: () => navigation.goBack() }]
            );
          }
        }
      } catch (error) {
        console.error('Error parsing message:', error);
      }
    };
    
    // First remove any existing listeners to prevent duplicates
    socket?.removeAllListeners('message');
    
    // Add the message listener
    socket?.on('message', handleMessage);
    
    return () => {
      // Remove the message listener when component unmounts
      socket?.removeListener('message', handleMessage);
    };
  }, [deviceIP, targetDeviceName, myIP, navigation, socket]);

  const sendConnectionRequest = () => {
    if (!socket || !myIP) return;
    
    try {
      const message = JSON.stringify({
        type: 'CONNECTION_REQUEST',
        sender: myIP,
        senderName: deviceName // Use the consistent device name
      });
      
      socket.send(
        Buffer.from(message),
        0,
        message.length,
        DISCOVERY_PORT,
        deviceIP,
        (err) => {
          if (err) {
            console.error('Failed to send connection request:', err);
            Alert.alert('Error', 'Failed to send connection request');
          } else {
            console.log('Connection request sent');
          }
        }
      );
    } catch (error) {
      console.error('Error sending connection request:', error);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Connect to {targetDeviceName}</Text>
      <Text style={styles.subtitle}>IP: {deviceIP}</Text>
      <Button title="Send Connection Request" onPress={sendConnectionRequest} />
      <Button title="Cancel" onPress={() => navigation.goBack()} color="#999" />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  subtitle: {
    marginBottom: 30,
    color: '#666',
  },
});

export default ConnectionRequestScreen;


