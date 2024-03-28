import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { formatTimeString } from './utils';

const MessageViewComponent = ({ notification, onPress }) => {
    const isRead = notification.read; // Assuming notification has a 'read' field to indicate its read status

    return (
        <Pressable onPress={onPress}>
            <View style={[styles.container, isRead ? styles.readContainer : styles.unreadContainer]}>
                <View>
                    <Text style={[styles.subject, isRead ? styles.readSubject : styles.unreadSubject]}>
                        {notification.payload.subject || notification.payload.messageType}
                    </Text>
                </View>
                <View style = {styles.infoContainer}>
                    <Text style={styles.sender}>From: {notification.payload.sender}</Text>
                    <Text style={styles.time}>{formatTimeString(notification.createdAt)}</Text>
                </View>
            </View>
        </Pressable>
    );
};

const styles = StyleSheet.create({
    container: {
        height: 50,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        maxWidth: '100%',
        wordWrap: 'break-word',
        marginLeft: 18,
        borderWidth: 1,
        borderColor: 'black',
        marginBottom: 5,
    },
    readContainer: {
        backgroundColor: 'lightgray', // Style for read notifications
    },
    unreadContainer: {
        backgroundColor: 'white', // Style for unread notifications
    },
    subject: {
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 5,
        textAlign: 'center',
    },
    readSubject: {
        color: 'gray', // Style for read notification subjects
    },
    unreadSubject: {
        color: 'black', // Style for unread notification subjects
    },
    infoContainer: {
        fontSize: 14,
        color: 'gray',
        flexDirection: 'row',
    },
    sender: {
        marginLeft: '10px',
    },
    time: {
        marginLeft: 'auto',
        marginRight: '10px',
    },
});

export default MessageViewComponent;
