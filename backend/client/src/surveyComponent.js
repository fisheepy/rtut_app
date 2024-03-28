import React from "react";
import { Model } from "survey-core";
import { Survey } from "survey-react-ui";
import "survey-core/defaultV2.min.css";
import * as SurveyTheme from "survey-core/themes";
import "./survey.css";

const customCss = {
    "question": {
        "content": "question-content",
        "answered": "question-answered",
        "titleRequired": "question-title-required"
    }
};

function SurveyComponent({ surveyJson }) { // Accept surveyJson as a prop
    const survey = new Model(surveyJson); // Use the passed surveyJson
    survey.applyTheme(SurveyTheme.BorderlessLight);
    survey.onComplete.add((sender, options) => {
        console.log(JSON.stringify(sender.data, null, 3));
    });
    survey.css = customCss;
    
    survey.onUpdateQuestionCssClasses.add(function(_, options) {
        const classes = options.cssClasses;
        classes.root = "question-root";
        if (options.question.getType() === "checkbox") {
            classes.root += " question-root-checkboxes";
        }
    });
    
    return (<Survey model={survey} />);
}

export default SurveyComponent;
