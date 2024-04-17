import React from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { formatTimeString } from './utils';
import { GiConfirmed } from "react-icons/gi";
import commonStyles from './styles/commonStyles';

const MessageDetailComponent = ({ notification, onBack, windowDimensions }) => {
    const styles = {
        container: { ...commonStyles.messageDetail.container, width: windowDimensions.width * 0.9 },
        content: commonStyles.messageDetail.content,
        subject: commonStyles.messageDetail.subject,
        infoContainer: { ...commonStyles.messageDetail.infoContainer, width: windowDimensions.width * 0.9 },
        body: { ...commonStyles.messageDetail.body, width: windowDimensions.width * 0.9 },
        buttonContainer: { ...commonStyles.messageDetail.buttonContainer, width: windowDimensions.width },
        time: commonStyles.messageDetail.time,
    };

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
