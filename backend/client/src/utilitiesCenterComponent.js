// utilitiesCenterComponent.js
import React, { useContext, useState } from 'react';
import { SelectedEmployeesContext } from './selectedEmployeesContext';
import EmployeeSelectionComponent from './employeeSelectionComponent';
import axios from 'axios';

const UtilitiesCenterComponent = () => {
    const { selectedEmployees } = useContext(SelectedEmployeesContext);
    const [executionStatus, setExecutionStatus] = useState('Status:');
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [showAddEmployeeForm, setShowAddEmployeeForm] = useState(false);
    const [newEmployee, setNewEmployee] = useState({
        firstName: '',
        lastName: '',
        hireDate: '',
        homeDepartment: '',
        jobTitle: '',
        location: '',
        supervisorName: ''
    });

    // Inside NotificationContext or a similar file
    const cleanAllNotifications = () => {
        const data = { selectedEmployees };
        axios.post('/call-function-delete-notifications', data)
            .then(response => {
                const timeStamp = new Date().toLocaleString('en-US', { timeZone: 'America/New_York' });
                setExecutionStatus(`Status:${timeStamp}:\tRequest delete notifications succeeded!`);
            })
            .catch(error => {
                const timeStamp = new Date().toLocaleString('en-US', { timeZone: 'America/New_York' });
                setExecutionStatus(`Status:${timeStamp}:\tRequest delete notifications succeeded!`);
            });
    };

    const handleDelete = () => {
        // Confirm with the user before proceeding
        const isConfirmed = window.confirm(`Are you sure you want to delete the employee: ${firstName} ${lastName}?`);

        if (isConfirmed) {
            axios.post('/call-function-delete-employee', { firstName, lastName })
                .then(response => {
                    // Handle successful deletion here
                    setExecutionStatus(`Employee ${firstName} ${lastName} deleted successfully.`);
                })
                .catch(error => {
                    // Handle errors here
                    setExecutionStatus(`Failed to delete employee ${firstName} ${lastName}.`);
                });
        }
    };
    const handleAddEmployeeChange = (e) => {
        const { name, value } = e.target;
        setNewEmployee(prevState => ({
            ...prevState,
            [name]: value
        }));
    };

    const handleAddEmployeeSubmit = () => {
        // Confirm with the user before proceeding
        const isConfirmed = window.confirm(`Are you sure you want to add this employee?`);
        
        if (isConfirmed) {
            axios.post('/call-function-add-employee', newEmployee)
                .then(response => {
                    // Handle successful addition here
                    setExecutionStatus(`Employee ${newEmployee.firstName} ${newEmployee.lastName} added successfully.`);
                    setShowAddEmployeeForm(false); // Close the form modal
                })
                .catch(error => {
                    // Handle errors here
                    setExecutionStatus(`Failed to add employee ${newEmployee.firstName} ${newEmployee.lastName}.`);
                });
        }
    };

    return (
        <div>
            {/* Assuming you have some styling and structure for your utility */}
            <h3>Execution Status</h3>
            <p className="execution-status">{executionStatus}</p>
            <button onClick={cleanAllNotifications}>Clean All Notifications</button>
            <h3>Delete Employee</h3>
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
            <button onClick={handleDelete}>Delete Employee</button>
            <button onClick={() => setShowAddEmployeeForm(true)}>Add New Employee</button>

            {showAddEmployeeForm && (
                <div className="modal">
                    <h3>Add New Employee</h3>
                    <input name="firstName" type="text" placeholder="First Name" value={newEmployee.firstName} onChange={handleAddEmployeeChange} />
                    <input name="lastName" type="text" placeholder="Last Name" value={newEmployee.lastName} onChange={handleAddEmployeeChange} />
                    <input name="hireDate" type="date" placeholder="Hire Date" value={newEmployee.hireDate} onChange={handleAddEmployeeChange} />
                    <input name="homeDepartment" type="text" placeholder="Home Department" value={newEmployee.homeDepartment} onChange={handleAddEmployeeChange} />
                    <input name="jobTitle" type="text" placeholder="Job Title" value={newEmployee.jobTitle} onChange={handleAddEmployeeChange} />
                    <input name="location" type="text" placeholder="Location" value={newEmployee.location} onChange={handleAddEmployeeChange} />
                    <input name="supervisorName" type="text" placeholder="Supervisor Name" value={newEmployee.supervisorName} onChange={handleAddEmployeeChange} />
                    <button onClick={handleAddEmployeeSubmit}>Submit</button>
                    <button onClick={() => setShowAddEmployeeForm(false)}>Cancel</button>
                </div>
            )}
            <hr />
            <EmployeeSelectionComponent />
            <hr />
        </div>
    );
};

export default UtilitiesCenterComponent;
