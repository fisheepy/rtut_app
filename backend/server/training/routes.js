const express = require('express');
const { MongoClient, ServerApiVersion } = require('mongodb');
const { normalizeEmployee } = require('./employeeData');

function createTrainingRouter({ uri, databaseName }) {
  const router = express.Router();

  router.get('/employees', async (_req, res) => {
    const client = new MongoClient(uri, {
      serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
      },
    });

    try {
      await client.connect();
      const db = client.db(databaseName);
      const employees = await db.collection('employees').find({}).project({
        'First Name': 1,
        'Last Name': 1,
        'Job Title': 1,
        Location: 1,
        Department: 1,
        'Home Department': 1,
        'Hire Date': 1,
        'First Day': 1,
        'Termination Date': 1,
        'Termination Day': 1,
        'Supervisor First Name': 1,
        'Supervisor Last Name': 1,
        'Account Active': 1,
        'Position Status': 1,
      }).toArray();

      const employeeIds = employees.map((employee) => String(employee._id));
      const trainingRecords = employeeIds.length
        ? await db.collection('employee_training').find({
          employeeId: { $in: employeeIds },
        }).toArray()
        : [];
      const trainingByEmployeeId = new Map(
        trainingRecords.map((record) => [String(record.employeeId), record]),
      );

      const data = employees
        .map((employee) => normalizeEmployee(
          employee,
          trainingByEmployeeId.get(String(employee._id)),
        ))
        .sort((left, right) => {
          if (left.employmentStatus !== right.employmentStatus) {
            return left.employmentStatus === 'Active' ? -1 : 1;
          }
          return left.employeeName.localeCompare(right.employeeName);
        });

      res.json({
        employees: data,
        source: 'Company App employee roster',
        trainingTypes: ['Orientation Training', 'Monthly Training'],
      });
    } catch (error) {
      console.error('Unable to load training employees:', error);
      res.status(500).json({
        error: 'Employee training information could not be loaded. Please try again.',
      });
    } finally {
      await client.close();
    }
  });

  return router;
}

module.exports = { createTrainingRouter };
