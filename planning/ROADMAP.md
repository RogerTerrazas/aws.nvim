# ROADMAP

## FEATURES PLANNED

### Cloudwatch Logs Insights
- users should be able to see a cloudwatch insights view similar to that on the aws console except the query builder / log selection view is seperate from the results view. Similar to how the ddb query feature is implemented
- users should be able to select the log groups they want to include in their query
- users should be able to write log insights ql to query the log group they would want, withing the @message filed selected and the @message like template prepoluted
- users should be able to the limit the amount of logs returned
- users should be able to specify a relative time window in minutes, hours, or days
- user should be able to specific an absolute time line in a date-date format where a date could be of any precesions such as day, hour, minute, or second

### Plugin Configurations
- users should be able to configure an authorization command to run tied to an aws profile
- configurations should live in the user ~/.config folder and be decoupled from neovime
- the plugin solution should be robust enough to also accept plugin configurations from the neovim integration when a user defines the plugin in their own config, but overriden if the have a dedicated config folder
- other configurations that will eventually be implemented are service specific preferences like number of items to return, key mapping overridesf

## FEATURES READY
- AWS-PROFILE-SELECTION.md
