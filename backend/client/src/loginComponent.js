import React, { useState } from 'react';
import axios from "axios";

function LoginComponent({ onLoginStatusChange, onLoginSuccess }) {
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [enteredCode, setEnteredCode] = useState('');
    const [userMessage, setUserMessage] = useState('');

    const handleLogin = async() => {
        const data = { firstName, lastName, enteredCode };

        const response = await fetch('/call-function-validate-log-in', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ firstName, lastName, enteredCode })
        });

        if (response.ok) {
            setUserMessage('');
            onLoginStatusChange(true); // Call the function to update login status
            onLoginSuccess({ firstName: firstName, lastName: lastName });
            localStorage.setItem('loginName', JSON.stringify({ firstName: firstName, lastName: lastName }));
        } else {
            const errorMsg = await response.text();
            alert(errorMsg); // Shows why the login failed
            setUserMessage('Invalid Login Attempt!');
            onLoginStatusChange(false); 
        }
    };

    const handleRequestCode = () => {
        const data = { firstName, lastName }; // Pass the generated code to the server
        // Make an HTTP request to a server endpoint to generate a one-time code
        axios.post('/call-function-send-one-time-code', data)
            .then(response => {
                setUserMessage('A one-time code is sent.');
            })
            .catch(error => {
                if (error.response.status === 403) {
                    // User is not an admin, display a warning
                    setUserMessage('You are not authorized to request a one-time code.');
                } else {
                    // Handle other errors if needed
                }
            });
    };

    return (
        <div>
            <div className='login-header'>
                <h1>Login</h1>
            </div>
            <div className="login-container">
                <input
                    type="text"
                    placeholder="First Name"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                />
                <input
                    type="text"
                    placeholder="Last Name"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                />
                <button onClick={handleRequestCode}>Request One-Time Code</button>
            </div>
            <div className="login-container"> {/* New div for Enter Code and Login */}
                <input
                    type="text"
                    placeholder="Enter Code"
                    value={enteredCode}
                    onChange={(e) => setEnteredCode(e.target.value)}
                />
                <button onClick={handleLogin}>Login</button>
                {userMessage && <p className="user-message">{userMessage}</p>}
            </div>
        </div>
    )
}

export default LoginComponent;
