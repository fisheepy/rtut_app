const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { compareCommissionFiles } = require('./parser');
const { writeCommissionReport } = require('./reportWriter');

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function readJobs(jobsDir) {
  if (!fs.existsSync(jobsDir)) return [];
  return fs.readdirSync(jobsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const metadataPath = path.join(jobsDir, entry.name, 'metadata.json');
      if (!fs.existsSync(metadataPath)) return null;
      try {
        return JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
      } catch (_) {
        return null;
      }
    })
    .filter(Boolean)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

function createPayrollVerificationRouter({ upload, uploadDirectory, logOperationToDatabase }) {
  const router = express.Router();
  const jobsDir = path.join(uploadDirectory, 'payroll-verification');
  ensureDir(jobsDir);

  router.get('/jobs', (req, res) => {
    res.json(readJobs(jobsDir).slice(0, 20));
  });

  router.get('/jobs/:jobId', (req, res) => {
    const metadataPath = path.join(jobsDir, req.params.jobId, 'metadata.json');
    if (!fs.existsSync(metadataPath)) return res.status(404).json({ error: 'Job not found' });
    res.json(JSON.parse(fs.readFileSync(metadataPath, 'utf8')));
  });

  router.get('/jobs/:jobId/report', (req, res) => {
    const metadataPath = path.join(jobsDir, req.params.jobId, 'metadata.json');
    if (!fs.existsSync(metadataPath)) return res.status(404).json({ error: 'Job not found' });

    const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
    if (metadata.status !== 'completed' || !metadata.reportPath || !fs.existsSync(metadata.reportPath)) {
      return res.status(404).json({ error: 'Report is not available' });
    }

    res.download(metadata.reportPath, metadata.reportFileName || 'Commission_Verification_Report.xlsx');
  });

  router.post('/jobs', upload.fields([
    { name: 'commissionFile', maxCount: 1 },
    { name: 'payrollFile', maxCount: 1 },
  ]), async (req, res) => {
    const commissionFile = req.files?.commissionFile?.[0];
    const payrollFile = req.files?.payrollFile?.[0];
    const adminUser = req.body?.adminUser ? safeJsonParse(req.body.adminUser) : null;

    if (!commissionFile || !payrollFile) {
      return res.status(400).json({ error: 'Both commissionFile and payrollFile are required.' });
    }

    const jobId = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
    const jobDir = path.join(jobsDir, jobId);
    ensureDir(jobDir);

    const reportFileName = `Commission_Verification_Report_${jobId}.xlsx`;
    const reportPath = path.join(jobDir, reportFileName);
    const metadataPath = path.join(jobDir, 'metadata.json');
    const createdAt = new Date().toISOString();

    try {
      const result = compareCommissionFiles({
        hrFilePath: commissionFile.path,
        payrollFilePath: payrollFile.path,
      });

      await writeCommissionReport(result, reportPath);

      const metadata = {
        jobId,
        status: 'completed',
        createdAt,
        completedAt: new Date().toISOString(),
        commissionFileName: commissionFile.originalname,
        payrollFileName: payrollFile.originalname,
        reportFileName,
        reportPath,
        reportUrl: `/api/payroll-verification/jobs/${jobId}/report`,
        summary: result.summary,
      };

      fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));

      await logOperationToDatabase?.({
        action: 'payroll_commission_verification',
        adminUser,
        selectedEmployees: [],
        payloadSummary: {
          jobId,
          commissionFileName: commissionFile.originalname,
          payrollFileName: payrollFile.originalname,
          summary: result.summary,
        },
        status: 'success',
      });

      res.json(metadata);
    } catch (error) {
      const metadata = {
        jobId,
        status: 'failed',
        createdAt,
        completedAt: new Date().toISOString(),
        commissionFileName: commissionFile.originalname,
        payrollFileName: payrollFile.originalname,
        error: error.message,
      };

      fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));

      await logOperationToDatabase?.({
        action: 'payroll_commission_verification',
        adminUser,
        selectedEmployees: [],
        payloadSummary: {
          jobId,
          commissionFileName: commissionFile.originalname,
          payrollFileName: payrollFile.originalname,
        },
        status: 'failed',
        errorMessage: error.stack || error.message,
      });

      res.status(500).json({ error: error.message, jobId });
    } finally {
      [commissionFile.path, payrollFile.path].forEach((filePath) => {
        fs.unlink(filePath, () => {});
      });
    }
  });

  return router;
}

function safeJsonParse(value) {
  try {
    return JSON.parse(value);
  } catch (_) {
    return null;
  }
}

module.exports = { createPayrollVerificationRouter };
