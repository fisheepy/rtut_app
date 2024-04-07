import React, { useContext, useState } from 'react';
import { SelectedEmployeesContext } from './selectedEmployeesContext';
import axios from 'axios';
import { Button, TextField, Dialog, DialogActions, DialogContent, DialogTitle } from '@mui/material';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import './App.css';

const UtilitiesCenterComponent = () => {
    const { selectedEmployees } = useContext(SelectedEmployeesContext);
    const [executionStatus, setExecutionStatus] = useState('Status:');
    const [openAddModal, setOpenAddModal] = useState(false);
    const [openDeleteModal, setOpenDeleteModal] = useState(false);
    const [deleteEmployee, setDeleteEmployee] = useState({ firstName: '', lastName: '' });
    const [newEmployee, setNewEmployee] = useState({
        firstName: '',
        lastName: '',
        hireDate: new Date().toISOString().split('T')[0],
        homeDepartment: '',
        jobTitle: '',
        location: '',
        supervisorFirstName: '',
        supervisorLastName: '',
    });

    const handleAddEmployeeChange = (field, value) => {
        // If the change comes from the DatePicker, field will directly be 'hireDate', and value will be the Date object
        if (field === 'hireDate') {
            const formattedDate = value.toISOString().split('T')[0]; // Format the date to 'yyyy-MM-dd'
            console.log(formattedDate);
            setNewEmployee(prevState => ({ ...prevState, [field]: formattedDate }));
        } else {
            // For other inputs, field is derived from event.target.name, and value from event.target.value
            setNewEmployee(prevState => ({ ...prevState, [field]: value }));
        }
    };

    const handleDeleteEmployeeChange = (e) => {
        const { name, value } = e.target;
        setDeleteEmployee(prevState => ({ ...prevState, [name]: value }));
    };

    const handleAddEmployeeSubmit = async () => {
        // Submit new employee to backend
        try {
            await axios.post('/call-function-add-employee', newEmployee);
            setExecutionStatus(`Employee ${newEmployee.firstName} ${newEmployee.lastName} added successfully.`);
            setOpenAddModal(false);
        } catch (error) {
            setExecutionStatus(`Failed to add employee ${newEmployee.firstName} ${newEmployee.lastName}.`);
        }
    };

    const handleDeleteEmployeeSubmit = async () => {
        // Submit delete request to backend
        try {
            await axios.post('/call-function-delete-employee', deleteEmployee);
            setExecutionStatus(`Employee ${deleteEmployee.firstName} ${deleteEmployee.lastName} deleted successfully.`);
            setOpenDeleteModal(false);
        } catch (error) {
            setExecutionStatus(`Failed to delete employee ${deleteEmployee.firstName} ${deleteEmployee.lastName}.`);
        }
    };

    return (
        <div>
            <h3>Execution Status</h3>
            <p>{executionStatus}</p>
            <Button variant="outlined" color="primary" onClick={() => setOpenAddModal(true)}>
                Add New Employee
            </Button>
            <Button variant="outlined" color="secondary" onClick={() => setOpenDeleteModal(true)}>
                Delete Employee
            </Button>
            {/* Add Employee Modal */}
            <Dialog open={openAddModal} onClose={() => setOpenAddModal(false)}>
                <DialogTitle>Add New Employee</DialogTitle>
                <DialogContent>
                    <TextField autoFocus margin="dense" name="firstName" label="First Name" type="text" fullWidth variant="outlined"     onChange={(e) => handleAddEmployeeChange(e.target.name, e.target.value)}/>
                    <TextField margin="dense" name="lastName" label="Last Name" type="text" fullWidth variant="outlined"     onChange={(e) => handleAddEmployeeChange(e.target.name, e.target.value)}/>
                    <DatePicker
                        selected={new Date(newEmployee.hireDate)}
                        onChange={(date) => handleAddEmployeeChange('hireDate', date)}
                        dateFormat="yyyy-MM-dd" // Customize the date format as needed
                        wrapperClassName="datePicker"
                        />
                    <TextField margin="dense" name="homeDepartment" label="Home Department" type="text" fullWidth variant="outlined" onChange={(e) => handleAddEmployeeChange(e.target.name, e.target.value)}/>
                    <TextField margin="dense" name="jobTitle" label="Job Title" type="text" fullWidth variant="outlined" onChange={(e) => handleAddEmployeeChange(e.target.name, e.target.value)}/>
                    <TextField margin="dense" name="location" label="Location" type="text" fullWidth variant="outlined" onChange={(e) => handleAddEmployeeChange(e.target.name, e.target.value)}/>
                    <TextField margin="dense" name="supervisorFirstName" label="Supervisor Last Name" type="text" fullWidth variant="outlined" onChange={(e) => handleAddEmployeeChange(e.target.name, e.target.value)}/>
                    <TextField margin="dense" name="supervisorLastName" label="Supervisor Last Name" type="text" fullWidth variant="outlined" onChange={(e) => handleAddEmployeeChange(e.target.name, e.target.value)}/>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setOpenAddModal(false)}>Cancel</Button>
                    <Button onClick={handleAddEmployeeSubmit}>Submit</Button>
                </DialogActions>
            </Dialog>

            {/* Delete Employee Modal */}
            <Dialog open={openDeleteModal} onClose={() => setOpenDeleteModal(false)}>
                <DialogTitle>Delete Employee</DialogTitle>
                <DialogContent>
                    <TextField autoFocus margin="dense" name="firstName" label="First Name" type="text" fullWidth variant="outlined" onChange={handleDeleteEmployeeChange} />
                    <TextField margin="dense" name="lastName" label="Last Name" type="text" fullWidth variant="outlined" onChange={handleDeleteEmployeeChange} />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setOpenDeleteModal(false)}>Cancel</Button>
                    <Button onClick={handleDeleteEmployeeSubmit}>Delete</Button>
                </DialogActions>
            </Dialog>
        </div>
    );
};

export default UtilitiesCenterComponent;
