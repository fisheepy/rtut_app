import React from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { formatTimeString } from './utils';
import { GiConfirmed } from "react-icons/gi";

const MessageDetailComponent = ({ notification, onBack, windowDimensions }) => {
    const styles = StyleSheet.create({
        container: {
            flex: 1, 
            justifyContent: 'space-between',
            alignItems: 'center',
            backgroundColor: '#d8dee6',
            width: windowDimensions.width * 0.9,
        },
        content: {
            paddingBottom: 30, 
            minHeight: '30vw',
        },
        subject: {
            fontSize: 18,
            fontWeight: 'bold',
            textAlign: 'center',
            marginBottom: 5,
            justifyContent: 'flex-start',
            alignItems: 'flex-start',
        },
        info: {
            fontSize: 16,
            color: 'gray',
            textAlign: 'left',
            paddingHorizontal: 32,
        },
        body: {
            marginTop: 15,
            marginBottom: 15,
            fontSize: 16,
            color: 'black',
            textAlign: 'justify',
            justifyContent: 'center',
            alignItems: 'center',
            width: windowDimensions.width * 0.9,
            paddingHorizontal: 16,
        },
        buttonContainer: {
            flexDirection: 'row',
            justifyContent: 'center',
            backgroundColor: '#d8dee6',
            width: windowDimensions.width * 1,
          },
        buttonText: {
            fontSize: 16,
            lineHeight: 21,
            fontWeight: 'bold',
            letterSpacing: 0.25,
            color: 'white',
        },
        infoContainer: {
            fontSize: 14,
            color: 'gray',
            flexDirection: 'row',
            width: windowDimensions.width * 0.9,
        },
        sender: {
            marginLeft: '15px',
        },
        time: {
            marginLeft: 'auto',
            marginRight: '15px',
        },
    });

    return (
        <View style={styles.container}>
            <ScrollView style={styles.content} nestedScrollEnabled={true}>
                <Text style={styles.subject}>{notification.payload.messageType}</Text>
                <View style = {styles.infoContainer}>
                    <Text style={styles.sender}>From: {notification.payload.sender}</Text>
                    <Text style={styles.time}>{formatTimeString(notification.createdAt)}</Text>
                </View>
                <Text style={styles.body}>{notification.payload.messageContent}</Text>
            </ScrollView>
            <View style={styles.buttonContainer}>
                <Pressable onPress={onBack}>
                    <GiConfirmed
                        style={{ ...styles.button, pointerEvents: "none" }}
                        fontSize={40}
                        color='Green'
                    />
                </Pressable>
            </View>
        </View>
    );
};

export default MessageDetailComponent;
