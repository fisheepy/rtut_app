import React, { useState, useEffect, useContext, useRef } from 'react';
import axios from 'axios';
import { SelectedEmployeesContext } from './selectedEmployeesContext';
import {
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Checkbox,
    Paper,
    TextField,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    Grid,
    Autocomplete,
    Box,
    Chip,
    Collapse,
    Stack,
    Typography,
} from '@mui/material';
import FilterAltOutlinedIcon from '@mui/icons-material/FilterAltOutlined';
import SearchIcon from '@mui/icons-material/Search';
import TuneIcon from '@mui/icons-material/Tune';

const parseEmployeeDate = (value) => {
    if (!value) return null;
    const text = String(value).trim();
    const isoMatch = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (isoMatch) return { year: isoMatch[1], month: isoMatch[2], day: isoMatch[3] };
    const usMatch = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2}|\d{4})$/);
    if (usMatch) return {
        year: usMatch[3].length === 2 ? `20${usMatch[3]}` : usMatch[3],
        month: usMatch[1],
        day: usMatch[2],
    };
    const parsed = new Date(text);
    if (Number.isNaN(parsed.getTime())) return null;
    return {
        year: String(parsed.getUTCFullYear()),
        month: String(parsed.getUTCMonth() + 1),
        day: String(parsed.getUTCDate()),
    };
};

const formatEmployeeDate = (value) => {
    const parsed = parseEmployeeDate(value);
    if (!parsed) return value || '';
    return `${String(parsed.month).padStart(2, '0')}/${String(parsed.day).padStart(2, '0')}/${parsed.year}`;
};

const employeeDateInputValue = (value) => {
    const parsed = parseEmployeeDate(value);
    if (!parsed) return '';
    return `${parsed.year}-${String(parsed.month).padStart(2, '0')}-${String(parsed.day).padStart(2, '0')}`;
};

function EmployeeSelectionComponent() {
    const { selectedEmployees, setSelectedEmployees } = useContext(SelectedEmployeesContext);
    const tableContainerRef = useRef(null);
    const topScrollRef = useRef(null);
    const [employees, setEmployees] = useState([]);
    const [filteredEmployees, setFilteredEmployees] = useState([]);
    const [filterValues, setFilterValues] = useState({});
    const [selectedFilters, setSelectedFilters] = useState({ isActivated: ['true'] }); // Default to "true" for "Activated"
    const [startDate, setStartDate] = useState('1980-01-01');
    const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
    const [deselectedEmployees, setDeselectedEmployees] = useState(new Set());
    const [selectAllChecked, setSelectAllChecked] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [selectedEmployee, setSelectedEmployee] = useState(null);
    const [employeeSearch, setEmployeeSearch] = useState('');
    const [showMoreFilters, setShowMoreFilters] = useState(false);

    useEffect(() => {
        applyFilters();
    }, [selectedFilters, employees, deselectedEmployees, startDate, endDate, employeeSearch]);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const response = await axios.get('/employees');
                const processedData = response.data.map(employee => ({
                    ...employee,
                    'Name': `${employee['Last Name']}, ${employee['First Name']}`,
                    'Supervisor': `${employee['Supervisor Last Name']}, ${employee['Supervisor First Name']}`
                }));
                const sortedData = processedData.sort((a, b) => a['Last Name'].localeCompare(b['Last Name']));
                setEmployees(sortedData);
                setFilteredEmployees(sortedData);
                extractFilterValues(sortedData);
                setSelectedEmployees(sortedData);
            } catch (error) {
                console.error('Error fetching data:', error);
            }
        };

        fetchData();
    }, []);

    const handleStartDateChange = (e) => {
        setStartDate(e.target.value);
    };

    const handleEndDateChange = (e) => {
        setEndDate(e.target.value);
    };

    const extractFilterValues = (data) => {
        const values = {};
        if (data.length > 0) {
            for (const column of Object.keys(data[0])) {
                const uniqueValues = [...new Set(data.map((item) => item[column]))];
                values[column] = uniqueValues;
            }
        }

        setFilterValues(values);

        setSelectedFilters(prevFilters => {
            const nextFilters = {};

            Object.entries(prevFilters).forEach(([columnName, selectedOptions]) => {
                if (!Array.isArray(selectedOptions)) {
                    nextFilters[columnName] = selectedOptions;
                    return;
                }

                const availableOptions = values[columnName] || [];
                const validOptions = selectedOptions.filter(option => availableOptions.includes(option));

                if (validOptions.length > 0) {
                    nextFilters[columnName] = validOptions;
                }
            });

            return nextFilters;
        });
    };

    useEffect(() => {
        extractFilterValues(employees);
    }, [employees]);

    const setFilterSelection = (columnName, values) => {
        setSelectedFilters(prevFilters => {
            if (!values.length) {
                const nextFilters = { ...prevFilters };
                delete nextFilters[columnName];
                return nextFilters;
            }
            return { ...prevFilters, [columnName]: values };
        });
    };

    const resetFilters = () => {
        setSelectedFilters({ isActivated: ['true'] });
        setStartDate('1980-01-01');
        setEndDate(new Date().toISOString().split('T')[0]);
        setEmployeeSearch('');
    };

    const applyFilters = () => {
        const payrollNameFilter = selectedFilters['Name'];
        const defaultStartDate = new Date('1995/01/01');
        const defaultEndDate = new Date();
        const start = startDate ? new Date(startDate) : defaultStartDate;
        const end = endDate ? new Date(endDate) : defaultEndDate;

        const filteredByPayrollName = payrollNameFilter && payrollNameFilter.length > 0
            ? employees.filter(employee => payrollNameFilter.includes(employee['Name']))
            : [];

        const filteredByOtherCriteria = employees.filter(employee => {
            const hireDate = new Date(employee['Hire Date']);
            const isInDateRange = hireDate >= start && hireDate <= end;
            const normalizedSearch = employeeSearch.trim().toLowerCase();
            const matchesSearch = !normalizedSearch || [employee.Name, employee.Email, employee.Phone]
                .some(value => String(value || '').toLowerCase().includes(normalizedSearch));
            const matchesOtherFilters = Object.entries(selectedFilters).every(([columnName, filterValues]) =>
                columnName === 'Name' ||
                filterValues.length === 0 || filterValues.includes(employee[columnName])
            );

            return isInDateRange && matchesSearch && matchesOtherFilters;
        });

        const combinedFilteredEmployees = [
            ...filteredByPayrollName,
            ...filteredByOtherCriteria.filter(employee =>
                !filteredByPayrollName.some(filteredEmployee => filteredEmployee['Name'] === employee['Name'])
            )
        ];
        const finalFilteredEmployees = combinedFilteredEmployees.filter(employee =>
            !deselectedEmployees.has(employee._id)
        );

        setFilteredEmployees(combinedFilteredEmployees);
        setSelectedEmployees(finalFilteredEmployees);
    };

    const handleCheckboxChange = (employeeId) => {
        setDeselectedEmployees(prev => {
            const newSet = new Set(prev);
            if (newSet.has(employeeId)) {
                newSet.delete(employeeId);
            } else {
                newSet.add(employeeId);
            }
            return newSet;
        });
    };

    const handleSelectAllChange = () => {
        setSelectAllChecked(!selectAllChecked);
        if (!selectAllChecked) {
            setDeselectedEmployees(new Set());
        } else {
            const allEmployeeIds = new Set(filteredEmployees.map(emp => emp._id));
            setDeselectedEmployees(allEmployeeIds);
        }
    };

    const handleRowDoubleClick = (employee) => {
        setSelectedEmployee(employee);
        setIsEditModalOpen(true);
    };

    const handleModalClose = () => {
        setIsEditModalOpen(false);
        setSelectedEmployee(null);
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setSelectedEmployee(prevEmployee => ({
            ...prevEmployee,
            [name]: value,
        }));
    };

    const handleSaveChanges = async () => {
        try {
            await axios.put(`/employees/${selectedEmployee._id}`, selectedEmployee);
            setEmployees((prevEmployees) => prevEmployees.map((emp) => (emp._id === selectedEmployee._id ? selectedEmployee : emp)));
            applyFilters();
            handleModalClose();
        } catch (error) {
            console.error('Error updating employee:', error);
        }
    };

    const columns = [
        { id: 'Hire Date', label: 'Hire Date', filter: false },
        { id: 'Name', label: 'Name (Override Add)', filter: true },
        { id: 'Position Status', label: 'Position Status', filter: true },
        { id: 'Home Department', label: 'Home Department', filter: true },
        { id: 'Job Title', label: 'Job Title', filter: true },
        { id: 'Location', label: 'Location', filter: true },
        { id: 'Supervisor', label: 'Supervisor', filter: true },
        { id: 'Phone', label: 'Phone', filter: true },
        { id: 'Email', label: 'Email', filter: true },
        { id: 'Worker Category', label: 'Employment', filter: true },
        { id: 'Pay Category', label: 'Pay', filter: true },
        { id: 'EEOC Establishment', label: 'EEOC', filter: true },
        { id: 'isActivated', label: 'Activated', filter: true },
        { id: 'select', label: '(Override Remove)', filter: false },
    ];

    const primaryFilterColumns = [
        { id: 'Position Status', label: 'Position Status' },
        { id: 'Home Department', label: 'Department' },
        { id: 'Job Title', label: 'Job Title' },
        { id: 'Location', label: 'Location' },
    ];

    const additionalFilterColumns = [
        { id: 'Supervisor', label: 'Supervisor' },
        { id: 'Worker Category', label: 'Employment' },
        { id: 'Pay Category', label: 'Pay Category' },
        { id: 'EEOC Establishment', label: 'EEOC Establishment' },
        { id: 'isActivated', label: 'Activated' },
    ];

    const activeFilterCount = Object.values(selectedFilters)
        .reduce((total, values) => total + (Array.isArray(values) ? values.length : 0), 0);

    const renderFilter = ({ id, label }) => (
        <Autocomplete
            key={id}
            multiple
            disableCloseOnSelect
            options={(filterValues[id] || []).filter(value => value !== null && value !== undefined && value !== '').sort((a, b) => String(a).localeCompare(String(b)))}
            value={selectedFilters[id] || []}
            onChange={(_event, values) => setFilterSelection(id, values)}
            getOptionLabel={(option) => String(option)}
            renderTags={(values, getTagProps) => values.slice(0, 2).map((option, index) => (
                <Chip label={String(option)} size="small" {...getTagProps({ index })} />
            )).concat(values.length > 2 ? [<Chip key="more" label={`+${values.length - 2}`} size="small" />] : [])}
            renderOption={(props, option, { selected }) => (
                <li {...props}>
                    <Checkbox checked={selected} size="small" sx={{ mr: 1 }} />
                    {String(option)}
                </li>
            )}
            renderInput={(params) => <TextField {...params} label={label} placeholder={selectedFilters[id]?.length ? '' : 'All'} size="small" />}
            size="small"
        />
    );

    const handleTopHorizontalScroll = (event) => {
        if (tableContainerRef.current) {
            tableContainerRef.current.scrollLeft = event.currentTarget.scrollLeft;
        }
    };

    const handleTableScroll = (event) => {
        if (topScrollRef.current) {
            topScrollRef.current.scrollLeft = event.currentTarget.scrollLeft;
        }
    };

    return (
        <div>
            <h3>Selected Employees</h3>
            <Paper
                elevation={0}
                sx={{
                    mb: 2,
                    overflow: 'hidden',
                    border: '1px solid #dbe3ee',
                    borderRadius: 3,
                    background: 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)',
                }}
            >
                <Box sx={{ px: { xs: 2, md: 2.5 }, py: 2, borderBottom: '1px solid #e8edf3' }}>
                    <Stack direction={{ xs: 'column', sm: 'row' }} alignItems={{ xs: 'stretch', sm: 'center' }} justifyContent="space-between" spacing={1.5}>
                        <Stack direction="row" alignItems="center" spacing={1.25}>
                            <Box sx={{ display: 'grid', placeItems: 'center', width: 38, height: 38, borderRadius: 2, bgcolor: '#e8f2ff', color: '#1769aa' }}>
                                <FilterAltOutlinedIcon fontSize="small" />
                            </Box>
                            <Box>
                                <Typography variant="subtitle1" fontWeight={700}>Filter Employees</Typography>
                                <Typography variant="body2" color="text.secondary">{filteredEmployees.length} of {employees.length} employees shown</Typography>
                            </Box>
                        </Stack>
                        <Stack direction="row" spacing={1}>
                            <Button startIcon={<TuneIcon />} onClick={() => setShowMoreFilters(value => !value)} size="small" variant={showMoreFilters ? 'contained' : 'outlined'}>
                                {showMoreFilters ? 'Hide More Filters' : 'More Filters'}
                            </Button>
                            <Button onClick={resetFilters} size="small" color="inherit">Reset</Button>
                        </Stack>
                    </Stack>
                </Box>
                <Box sx={{ p: { xs: 2, md: 2.5 } }}>
                    <Grid container spacing={2}>
                        <Grid item xs={12} md={4}>
                            <TextField
                                fullWidth
                                label="Search employee"
                                placeholder="Name, email, or phone"
                                value={employeeSearch}
                                onChange={(event) => setEmployeeSearch(event.target.value)}
                                size="small"
                                InputProps={{ startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.disabled' }} fontSize="small" /> }}
                            />
                        </Grid>
                        {primaryFilterColumns.map((column) => <Grid item xs={12} sm={6} md={2} key={column.id}>{renderFilter(column)}</Grid>)}
                    </Grid>
                    <Collapse in={showMoreFilters}>
                        <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid #e8edf3' }}>
                            <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ display: 'block', mb: 1.5, textTransform: 'uppercase', letterSpacing: '.06em' }}>Additional Filters</Typography>
                            <Grid container spacing={2}>
                                {additionalFilterColumns.map((column) => <Grid item xs={12} sm={6} md={2.4} key={column.id}>{renderFilter(column)}</Grid>)}
                                <Grid item xs={12} md={5}>
                                    <Autocomplete
                                        multiple
                                        options={(filterValues.Name || []).filter(Boolean).sort()}
                                        value={selectedFilters.Name || []}
                                        onChange={(_event, values) => setFilterSelection('Name', values)}
                                        renderInput={(params) => <TextField {...params} label="Add specific employees" helperText="Selected names are included even if they do not match other filters." size="small" />}
                                    />
                                </Grid>
                                <Grid item xs={12} sm={6} md={3.5}>
                                    <Stack direction="row" spacing={1}>
                                        <TextField fullWidth id="start-date" label="Hire Date From" type="date" value={startDate} onChange={handleStartDateChange} InputLabelProps={{ shrink: true }} size="small" />
                                        <TextField fullWidth id="end-date" label="Hire Date To" type="date" value={endDate} onChange={handleEndDateChange} InputLabelProps={{ shrink: true }} size="small" />
                                    </Stack>
                                </Grid>
                            </Grid>
                        </Box>
                    </Collapse>
                    {activeFilterCount ? <Stack direction="row" alignItems="center" spacing={1} sx={{ mt: 2 }}><Typography variant="caption" color="text.secondary">Active selections:</Typography><Chip label={activeFilterCount} color="primary" size="small" /></Stack> : null}
                </Box>
            </Paper>
            <div className="employee-scrollbar-proxy" ref={topScrollRef} onScroll={handleTopHorizontalScroll}>
                <div className="employee-scrollbar-proxy-inner" />
            </div>
            <TableContainer
                className="employee-table-container"
                component={Paper}
                ref={tableContainerRef}
                onScroll={handleTableScroll}
            >
                <Table className="employee-selection-table" aria-label="employee selection table" stickyHeader>
                    <TableHead>
                        <TableRow style={{ position: 'sticky', top: 0, zIndex: 2, backgroundColor: 'white' }}>
                            {columns.map((column) => (
                                <TableCell
                                    key={column.id}
                                    style={{ fontWeight: 'bold', backgroundColor: 'white' }}
                                >
                                    {column.id === 'select' ? (
                                        <div style={{ display: 'flex', alignItems: 'center' }}>
                                            <Checkbox
                                                checked={selectAllChecked}
                                                onChange={handleSelectAllChange}
                                                color="primary"
                                            />
                                            <span>(Override Remove)</span>
                                        </div>
                                    ) : column.label}
                                </TableCell>
                            ))}
                        </TableRow>
                    </TableHead>

                    <TableBody>
                        {filteredEmployees.map((employee) => (
                            <TableRow
                                key={employee._id}
                                onDoubleClick={() => handleRowDoubleClick(employee)}
                                style={{ textDecoration: deselectedEmployees.has(employee._id) ? 'line-through' : 'none' }}
                            >
                                {columns.map((column) => (
                                    <TableCell key={column.id}>
                                        {column.id === 'select' ? (
                                            <Checkbox
                                                checked={!deselectedEmployees.has(employee._id)}
                                                onChange={() => handleCheckboxChange(employee._id)}
                                                color="primary"
                                            />
                                        ) : (
                                            column.id === 'Hire Date' ? formatEmployeeDate(employee[column.id]) : employee[column.id] || ''
                                        )}
                                    </TableCell>
                                ))}
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </TableContainer>

            <Dialog open={isEditModalOpen} onClose={handleModalClose} maxWidth="md" fullWidth>
                <DialogTitle>Edit Employee Information</DialogTitle>
                <DialogContent>
                    {selectedEmployee && (
                        <Grid container spacing={2}>
                            <Grid item xs={6}>
                                <TextField
                                    fullWidth
                                    label="First Name"
                                    name="First Name"
                                    value={selectedEmployee['First Name']}
                                    onChange={handleInputChange}
                                />
                            </Grid>
                            <Grid item xs={6}>
                                <TextField
                                    fullWidth
                                    label="Last Name"
                                    name="Last Name"
                                    value={selectedEmployee['Last Name']}
                                    onChange={handleInputChange}
                                />
                            </Grid>
                            <Grid item xs={6}>
                                <TextField
                                    fullWidth
                                    label="Hire Date"
                                    name="Hire Date"
                                    type="date"
                                    value={employeeDateInputValue(selectedEmployee['Hire Date'])}
                                    onChange={handleInputChange}
                                    InputLabelProps={{ shrink: true }}
                                />
                            </Grid>
                            <Grid item xs={6}>
                                <TextField
                                    fullWidth
                                    label="Home Department"
                                    name="Home Department"
                                    value={selectedEmployee['Home Department']}
                                    onChange={handleInputChange}
                                />
                            </Grid>
                            <Grid item xs={6}>
                                <TextField
                                    fullWidth
                                    label="Supervisor First Name"
                                    name="Supervisor First Name"
                                    value={selectedEmployee['Supervisor First Name']}
                                    onChange={handleInputChange}
                                />
                            </Grid>
                            <Grid item xs={6}>
                                <TextField
                                    fullWidth
                                    label="Supervisor Last Name"
                                    name="Supervisor Last Name"
                                    value={selectedEmployee['Supervisor Last Name']}
                                    onChange={handleInputChange}
                                />
                            </Grid>
                            <Grid item xs={12}>
                                <TextField
                                    fullWidth
                                    label="Job Title"
                                    name="Job Title"
                                    value={selectedEmployee['Job Title']}
                                    onChange={handleInputChange}
                                />
                            </Grid>
                            <Grid item xs={12}>
                                <TextField
                                    fullWidth
                                    label="Location"
                                    name="Location"
                                    value={selectedEmployee['Location']}
                                    onChange={handleInputChange}
                                />
                            </Grid>
                            <Grid item xs={12}>
                                <TextField
                                    fullWidth
                                    label="Email"
                                    name="Email"
                                    value={selectedEmployee['Email']}
                                    onChange={handleInputChange}
                                />
                            </Grid>
                            <Grid item xs={12}>
                                <TextField
                                    fullWidth
                                    label="Phone"
                                    name="Phone"
                                    value={selectedEmployee['Phone']}
                                    onChange={handleInputChange}
                                />
                            </Grid>
                            <Grid item xs={12}>
                                <TextField
                                    fullWidth
                                    label="EEOC Establishment"
                                    name="EEOC Establishment"
                                    value={selectedEmployee['EEOC Establishment']}
                                    onChange={handleInputChange}
                                />
                            </Grid>
                            <Grid item xs={12}>
                                <TextField
                                    fullWidth
                                    label="Employment Category"
                                    name="Worker Category"
                                    value={selectedEmployee['Worker Category']}
                                    onChange={handleInputChange}
                                />
                            </Grid>
                            <Grid item xs={12}>
                                <TextField
                                    fullWidth
                                    label="Pay Category"
                                    name="Pay Category"
                                    value={selectedEmployee['Pay Category']}
                                    onChange={handleInputChange}
                                />
                            </Grid>
                        </Grid>
                    )}
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleModalClose}>Cancel</Button>
                    <Button onClick={handleSaveChanges} color="primary">Save</Button>
                </DialogActions>
            </Dialog>
        </div>
    );
}

export default EmployeeSelectionComponent;
