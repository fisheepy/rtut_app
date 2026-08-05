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
    Alert,
    Box,
    Chip,
    Collapse,
    Stack,
    Typography,
    FormControlLabel,
} from '@mui/material';
import FilterAltOutlinedIcon from '@mui/icons-material/FilterAltOutlined';
import SearchIcon from '@mui/icons-material/Search';
import TuneIcon from '@mui/icons-material/Tune';
import PeopleAltOutlinedIcon from '@mui/icons-material/PeopleAltOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import { canonicalizeEmployeeFilters } from './employeeFilterUtils';

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

const editableEmployeeFields = [
    'First Name', 'Last Name', 'Hire Date', 'Home Department', 'Supervisor First Name',
    'Supervisor Last Name', 'Job Title', 'Location', 'Email', 'Phone',
    'EEOC Establishment', 'Worker Category', 'Pay Category',
];

function EmployeeSelectionComponent() {
    const { selectedEmployees, setSelectedEmployees } = useContext(SelectedEmployeesContext);
    const tableContainerRef = useRef(null);
    const topScrollRef = useRef(null);
    const [employees, setEmployees] = useState([]);
    const [filteredEmployees, setFilteredEmployees] = useState([]);
    const [filterValues, setFilterValues] = useState({});
    const [selectedFilters, setSelectedFilters] = useState({ isActivated: [true] });
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [deselectedEmployees, setDeselectedEmployees] = useState(new Set());
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [selectedEmployee, setSelectedEmployee] = useState(null);
    const [originalEmployee, setOriginalEmployee] = useState(null);
    const [changeDetails, setChangeDetails] = useState({ effectiveDate: '', reason: '', payroll: false, insurance: false, retirement: false, trackOther: false });
    const [editError, setEditError] = useState('');
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
                    'Name': [employee['Last Name'], employee['First Name']].filter(Boolean).join(', '),
                    'Supervisor': [employee['Supervisor Last Name'], employee['Supervisor First Name']].filter(Boolean).join(', '),
                    isActivated: employee.isActivated === true || String(employee.isActivated).toLowerCase() === 'true',
                }));
                const sortedData = canonicalizeEmployeeFilters(processedData)
                    .sort((a, b) => a['Last Name'].localeCompare(b['Last Name']));
                const activatedEmployees = sortedData.filter(employee => employee.isActivated === true);
                setEmployees(sortedData);
                setFilteredEmployees(activatedEmployees);
                extractFilterValues(sortedData);
                setSelectedEmployees(activatedEmployees);
            } catch (error) {
                console.error('Error fetching data:', error);
            }
        };

        fetchData();
        window.addEventListener('employees-imported', fetchData);
        return () => window.removeEventListener('employees-imported', fetchData);
    }, [setSelectedEmployees]);

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
        setSelectedFilters({});
        setStartDate('');
        setEndDate('');
        setEmployeeSearch('');
        setDeselectedEmployees(new Set());
        setShowMoreFilters(false);
    };

    const applyFilters = () => {
        const start = startDate ? new Date(startDate) : null;
        const end = endDate ? new Date(endDate) : null;

        const matchingEmployees = employees.filter(employee => {
            const hireDate = new Date(employee['Hire Date']);
            const hasValidHireDate = !Number.isNaN(hireDate.getTime());
            const isInDateRange = (!start && !end)
                || (hasValidHireDate && (!start || hireDate >= start) && (!end || hireDate <= end));
            const normalizedSearch = employeeSearch.trim().toLowerCase();
            const matchesSearch = !normalizedSearch || [employee.Name, employee.Email, employee.Phone]
                .some(value => String(value || '').toLowerCase().includes(normalizedSearch));
            const matchesOtherFilters = Object.entries(selectedFilters).every(([columnName, filterValues]) =>
                filterValues.length === 0 || filterValues.includes(employee[columnName])
            );

            return isInDateRange && matchesSearch && matchesOtherFilters;
        });

        const finalFilteredEmployees = matchingEmployees.filter(employee =>
            employee.isActivated === true && !deselectedEmployees.has(employee._id)
        );

        setFilteredEmployees(matchingEmployees);
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
        const selectableEmployees = filteredEmployees.filter(employee => employee.isActivated === true);
        const allVisibleSelected = selectableEmployees.length > 0
            && selectableEmployees.every(employee => !deselectedEmployees.has(employee._id));
        setDeselectedEmployees(current => {
            const next = new Set(current);
            selectableEmployees.forEach(employee => {
                if (allVisibleSelected) next.add(employee._id);
                else next.delete(employee._id);
            });
            return next;
        });
    };

    const openEmployeeEditor = (employee) => {
        setOriginalEmployee(employee);
        setSelectedEmployee({ ...employee });
        setChangeDetails({ effectiveDate: '', reason: '', payroll: false, insurance: false, retirement: false, trackOther: false });
        setEditError('');
        setIsEditModalOpen(true);
    };

    const handleModalClose = () => {
        setIsEditModalOpen(false);
        setSelectedEmployee(null);
        setOriginalEmployee(null);
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setSelectedEmployee(prevEmployee => ({
            ...prevEmployee,
            [name]: value,
        }));
    };

    const handleSaveChanges = async () => {
        const changedFields = editableEmployeeFields.filter(field => String(originalEmployee?.[field] || '').trim() !== String(selectedEmployee?.[field] || '').trim());
        if (!changedFields.length) return setEditError('No information has been changed.');
        const tracked = changeDetails.payroll || changeDetails.insurance || changeDetails.retirement || changeDetails.trackOther;
        const review = changedFields.map(field => `${field}: ${originalEmployee[field] || '(blank)'} → ${selectedEmployee[field] || '(blank)'}`).join('\n');
        if (!window.confirm(`Review the following employee changes:\n\n${review}\n\nCompany App information will be updated immediately.${tracked ? '\nRequired follow-up will also be sent to HR Platform.' : ''}`)) return;
        try {
            const updatedEmployee = { ...originalEmployee };
            changedFields.forEach(field => { updatedEmployee[field] = selectedEmployee[field]; });
            updatedEmployee._employmentChange = { ...changeDetails, changedFields };
            await axios.put(`/employees/${selectedEmployee._id}`, updatedEmployee);
            const displayEmployee = { ...selectedEmployee, Name: [selectedEmployee['Last Name'], selectedEmployee['First Name']].filter(Boolean).join(', '), Supervisor: [selectedEmployee['Supervisor Last Name'], selectedEmployee['Supervisor First Name']].filter(Boolean).join(', ') };
            setEmployees((prevEmployees) => prevEmployees.map((emp) => (emp._id === selectedEmployee._id ? displayEmployee : emp)));
            applyFilters();
            handleModalClose();
        } catch (error) {
            console.error('Error updating employee:', error);
            setEditError(error.response?.data || 'The employee could not be updated.');
        }
    };

    const columns = [
        { id: 'Name', label: 'Name', filter: true, sticky: true },
        { id: 'edit', label: 'Edit Employee', filter: false },
        { id: 'Hire Date', label: 'Hire Date', filter: false },
        { id: 'Position Status', label: 'Status', filter: true },
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
        { id: 'select', label: 'Select', filter: false },
    ];

    const primaryFilterColumns = [
        { id: 'Position Status', label: 'Status' },
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
    const selectableVisibleEmployees = filteredEmployees.filter(employee => employee.isActivated === true);
    const selectedVisibleCount = selectableVisibleEmployees.filter(employee => !deselectedEmployees.has(employee._id)).length;

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
            <Box className="employee-section-heading">
                <Stack direction="row" alignItems="center" spacing={1.25}>
                    <Box className="employee-section-icon"><PeopleAltOutlinedIcon fontSize="small" /></Box>
                    <Box>
                        <Typography variant="h5" component="h3" fontWeight={750}>Employees</Typography>
                        <Typography variant="body2" color="text.secondary">Filter recipients, review details, or double-click a row to edit.</Typography>
                    </Box>
                </Stack>
                <Stack direction="row" spacing={1}>
                    <Chip label={`${filteredEmployees.length} shown`} variant="outlined" size="small" />
                    <Chip label={`${selectedVisibleCount} selected`} color="primary" size="small" />
                </Stack>
            </Box>
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
                                        renderInput={(params) => <TextField {...params} label="Name" helperText="Choose one or more employee names." size="small" />}
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
                        <TableRow>
                            {columns.map((column) => (
                                <TableCell
                                    key={column.id}
                                    className={column.sticky ? 'employee-name-cell employee-name-header' : ''}
                                >
                                    {column.id === 'select' ? (
                                        <div style={{ display: 'flex', alignItems: 'center' }}>
                                            <Checkbox
                                                checked={selectableVisibleEmployees.length > 0 && selectableVisibleEmployees.every(employee => !deselectedEmployees.has(employee._id))}
                                                indeterminate={selectableVisibleEmployees.some(employee => !deselectedEmployees.has(employee._id)) && selectableVisibleEmployees.some(employee => deselectedEmployees.has(employee._id))}
                                                onChange={handleSelectAllChange}
                                                color="primary"
                                            />
                                            <span>Select</span>
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
                                className={deselectedEmployees.has(employee._id) ? 'employee-row-deselected' : ''}
                            >
                                {columns.map((column) => (
                                    <TableCell key={column.id} className={column.sticky ? 'employee-name-cell' : ''}>
                                        {column.id === 'edit' ? <Button startIcon={<EditOutlinedIcon />} onClick={() => openEmployeeEditor(employee)} size="small" variant="outlined">Edit</Button> : column.id === 'select' ? (
                                            <Checkbox
                                                checked={employee.isActivated === true && !deselectedEmployees.has(employee._id)}
                                                disabled={employee.isActivated !== true}
                                                onChange={() => handleCheckboxChange(employee._id)}
                                                color="primary"
                                            />
                                        ) : (
                                            column.id === 'Hire Date'
                                                ? formatEmployeeDate(employee[column.id])
                                                : column.id === 'isActivated'
                                                    ? <Chip className="employee-activation-chip" label={employee[column.id] ? 'True' : 'False'} color={employee[column.id] ? 'success' : 'default'} size="small" variant={employee[column.id] ? 'filled' : 'outlined'} />
                                                    : employee[column.id] || ''
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
                            <Grid item xs={12}>
                                <Alert severity="info">Edit the information below. The system will automatically identify the fields that changed. Company App updates take effect immediately.</Alert>
                                {editError ? <Alert severity="error" sx={{ mt: 1 }}>{editError}</Alert> : null}
                            </Grid>
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
                            <Grid item xs={12}><Typography variant="h6">HR Action Tracking</Typography><Typography variant="body2" color="text.secondary">Payroll, Insurance, and 401(k) changes are always transferred to HR Platform. For other changes, choose whether HR follow-up is needed.</Typography></Grid>
                            <Grid item xs={12} sm={4}><FormControlLabel control={<Checkbox checked={changeDetails.payroll} onChange={event => setChangeDetails(current => ({ ...current, payroll: event.target.checked }))} />} label="Payroll change needed" /></Grid>
                            <Grid item xs={12} sm={4}><FormControlLabel control={<Checkbox checked={changeDetails.insurance} onChange={event => setChangeDetails(current => ({ ...current, insurance: event.target.checked }))} />} label="Insurance change needed" /></Grid>
                            <Grid item xs={12} sm={4}><FormControlLabel control={<Checkbox checked={changeDetails.retirement} onChange={event => setChangeDetails(current => ({ ...current, retirement: event.target.checked }))} />} label="401(k) change needed" /></Grid>
                            <Grid item xs={12}><FormControlLabel control={<Checkbox checked={changeDetails.trackOther} onChange={event => setChangeDetails(current => ({ ...current, trackOther: event.target.checked }))} />} label="Track this non-financial change in HR Platform" /></Grid>
                            {(changeDetails.payroll || changeDetails.insurance || changeDetails.retirement || changeDetails.trackOther) && <Grid item xs={12}><Alert severity="info">This record will be sent to Employment Change. HR Action Date and follow-up details will be entered there.</Alert></Grid>}
                        </Grid>
                    )}
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleModalClose}>Cancel</Button>
                    <Button onClick={handleSaveChanges} color="primary" variant="contained">Review Changes & Confirm</Button>
                </DialogActions>
            </Dialog>
        </div>
    );
}

export default EmployeeSelectionComponent;

