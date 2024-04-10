import { React, useState } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, Modal, Button, Alert } from 'react-native';
import axios from 'axios';

const UserSettingsComponent = () => {
    const [expanded, setExpanded] = useState(false);
    const [name, setName] = useState('');
    const [feedback, setFeedback] = useState('');
    const [modalVisible, setModalVisible] = useState(false);

    const handleFeedbackSubmit = () => {
        // Replace with your backend endpoint
        const feedbackEndpoint = 'https://yourbackend.endpoint/feedback';

        axios.post(feedbackEndpoint, { feedback })
            .then((response) => {
                Alert.alert('Feedback Submitted', 'Thank you for your feedback!', [{ text: 'OK' }]);
                setName('');
                setFeedback('');
                setModalVisible(false);
            })
            .catch((error) => {
                Alert.alert('Error', 'Failed to submit feedback. Please try again.', [{ text: 'OK' }]);
                console.error('Feedback submission error:', error);
            });
    };

    const handleCloseModal = () => {
        setModalVisible(false);
    };
    
    return (
        <View style={styles.container}>
            <Pressable onPress={() => setExpanded(!expanded)}>
                <Text style={styles.toggleText}>{expanded ? 'Collapse' : 'User Settings'}</Text>
            </Pressable>

            {expanded && (
                <Pressable
                    style={styles.feedbackButton}
                    onPress={() => setModalVisible(true)}
                >
                    {/* Use Icon component here, e.g., <Icon name="feedback" size={24} color="#000" /> */}
                    <Text style={styles.feedbackButtonText}>Submit Feedback</Text>
                </Pressable>
            )}
            <Modal
                animationType="slide"
                transparent={true}
                visible={modalVisible}
                onRequestClose={() => setModalVisible(!modalVisible)}
            >
                <View style={styles.centeredView}>
                    <View style={styles.modalView}>
                        <TextInput
                            style={styles.input}
                            onChangeText={setName}
                            value={name}
                            placeholder="Your Name"
                        />
                        <TextInput
                            style={styles.feedbackInput}
                            onChangeText={setFeedback}
                            value={feedback}
                            placeholder="Type your feedback here..."
                            multiline
                        />
                        <View style={styles.buttonGroup}>
                            <Pressable
                                style={styles.Button}
                                onPress={handleFeedbackSubmit}
                            >
                                <Text style={styles.textStyle}>Submit Feedback</Text>
                            </Pressable>
                            <Pressable
                                style={styles.Button}
                                onPress={() => setModalVisible(!modalVisible)}
                            >
                                <Text style={styles.textStyle}>Close</Text>
                            </Pressable>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 50,
    },
    toggleText: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#3273a8',
    },
    feedbackButton: {
        marginTop: 20,
        backgroundColor: '#007bff',
        padding: 10,
        borderRadius: 5,
    },
    feedbackButtonText: {
        color: '#ffffff',
    },
    centeredView: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.4)', // Semi-transparent background
    },
    modalView: {
        margin: 20,
        backgroundColor: '#6e909c',
        borderRadius: 20,
        padding: 35,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.25,
        shadowRadius: 4,
        elevation: 5,
        width: '50%', // Fixed width for the modal
        maxHeight: '80%', // Maximum height to avoid covering the entire screen
    },
    feedbackInput: {
        width: '100%', // Take up all available width within the modal
        minHeight: 100, // Minimum height for the text input
        marginBottom: 20, // Margin bottom for spacing
        borderColor: '#ccc', // Border color for the text input
        borderWidth: 1, // Border width
        padding: 10, // Padding inside the text input
    },
    buttonClose: {
        marginTop: 15,
    },
    textStyle: {
        color: "white",
        fontWeight: "bold",
        textAlign: "center"
    },
});

export default UserSettingsComponent;