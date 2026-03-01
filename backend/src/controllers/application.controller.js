import JobApplication from '../models/JobApplication.model.js';

export const getApplications = async (req, res, next) => {
  try {
    const { sessionId } = req.params;

    const applications = await JobApplication.find({
      sessionId,
      userId: req.user.userId,
    }).select('-tailoredCV').sort({ createdAt: 1 });

    res.json({ applications });
  } catch (error) {
    next(error);
  }
};

export const getApplication = async (req, res, next) => {
  try {
    const application = await JobApplication.findOne({
      _id: req.params.id,
      userId: req.user.userId,
    });

    if (!application) return res.status(404).json({ message: 'Application not found' });

    res.json({ application });
  } catch (error) {
    next(error);
  }
};

export const approveApplication = async (req, res, next) => {
  try {
    const { emailSubject, emailBody } = req.body;

    const application = await JobApplication.findOne({
      _id: req.params.id,
      userId: req.user.userId,
    });

    if (!application) return res.status(404).json({ message: 'Application not found' });
    if (application.status === 'SENT') {
      return res.status(400).json({ message: 'Application already sent' });
    }

    application.status = 'APPROVED';
    if (emailSubject) application.userEdits = { ...application.userEdits, emailSubject };
    if (emailBody) application.userEdits = { ...application.userEdits, emailBody };

    await application.save();

    res.json({ message: 'Application approved', application });
  } catch (error) {
    next(error);
  }
};

export const rejectApplication = async (req, res, next) => {
  try {
    const application = await JobApplication.findOne({
      _id: req.params.id,
      userId: req.user.userId,
    });

    if (!application) return res.status(404).json({ message: 'Application not found' });

    application.status = 'REJECTED';
    await application.save();

    res.json({ message: 'Application rejected', application });
  } catch (error) {
    next(error);
  }
};

export const getTailoredCV = async (req, res, next) => {
  try {
    const application = await JobApplication.findOne({
      _id: req.params.id,
      userId: req.user.userId,
    }).select('tailoredCV job.title job.company');

    if (!application) return res.status(404).json({ message: 'Application not found' });

    res.json({
      tailoredCV: application.tailoredCV,
      job: application.job,
    });
  } catch (error) {
    next(error);
  }
};
