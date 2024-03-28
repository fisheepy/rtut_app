import { React,useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';

const UserSettingsComponent = () => {
    const [expanded, setExpanded] = useState(false);


    return (
        <View style={styles.container}>
            <Pressable onPress={() => setExpanded(!expanded)}>
                <Text style={styles.toggleText}>{expanded ? 'Collapse' : 'User Settings'}</Text>
            </Pressable>

            {expanded && (
                <>
            
                </>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        justifyContent: 'top',
        alignItems: 'center',
        marginTop: 50,
    },
    iconLink: {
        flexDirection: 'column',
        alignItems: 'center',
        marginVertical: 10,
    },
    linkText: {
        fontSize: 12,
        color: 'black',
        textAlign: 'justify',
    },
    toggleText: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#3273a8',
        marginBottom: 10,
    },
});

export default UserSettingsComponent;
