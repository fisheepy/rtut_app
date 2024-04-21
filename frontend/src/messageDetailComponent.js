import React from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { formatTimeString } from './utils';
import { GiConfirmed } from "react-icons/gi";
import commonStyles from './styles/commonStyles';
import { useSpring, animated } from 'react-spring';
import { useDrag } from '@use-gesture/react';

const MessageDetailComponent = ({ notification, onBack, windowDimensions }) => {
    const styles = {
        container: { ...commonStyles.messageDetail.container },
        content: commonStyles.messageDetail.content,
        contentContainer: {...commonStyles.messageDetail.contentContainer },
        subject: commonStyles.messageDetail.subject,
        infoContainer: { ...commonStyles.messageDetail.infoContainer },
        body: { ...commonStyles.messageDetail.body },
        buttonContainer: { ...commonStyles.messageDetail.buttonContainer, width: windowDimensions.width },
        time: commonStyles.messageDetail.time,
    };

    const [style, api] = useSpring(() => ({ x: 0 }));

    const bind = useDrag(({ down, movement: [mx], direction: [xDir], velocity }) => {
        const trigger = velocity > 0.2; // Adjust velocity threshold as needed
        const dir = xDir < 0 ? -1 : 1; // Detect direction (-1 for left, 1 for right)
        console.log(down, velocity);
        if (!down && dir === 1) { // Trigger onBack when swipe left
            onBack();
        } else {
            api.start({ x: down ? mx : 0 }); // Reset position when drag ends
        }
    }, { axis: 'x' });

    return (
        <View style={styles.container}>
            <animated.div {...bind()} style={{ x: style.x, touchAction: 'none' }}>
                <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer} nestedScrollEnabled={true}>
                    <Text style={styles.subject}>{notification.payload.messageType}</Text>
                    <View style={styles.infoContainer}>
                        <Text style={styles.sender}>From: {notification.payload.sender}</Text>
                        <Text style={styles.time}>{formatTimeString(notification.createdAt)}</Text>
                    </View>
                    <Text style={styles.body}>{notification.payload.messageContent}</Text>
                </ScrollView>
            </animated.div>
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
