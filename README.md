#Gleam.solver
##Purpose
Automates entry into both types of Gleam.io Giveaways: Instant-wins and Raffles

**Disclaimer**: The usage of this script violates Gleam.io's Terms of Service.  Use at your own risk.

####Instant-win mode

The script will automatically complete the required social media activities, and then after you've received credit for doing so, it will automatically undo them.  For example, if you're required to join a certain Steam group, it will join that group, give you credit for it, and then leave the group. If you were already the member of that group, then the script give you credit for being a member, but it will not leave the group.

If the script doesn't auto-complete a certain entry type in this mode, then it's because the script doesn't have the ability to undo it, and so you'll have to complete it manually.

####Raffle mode

In the case of raffles, you may be disqualified for undoing any of the social media actions that the raffle asks of you. To prevent this, the script will only auto-complete the entries, it will not undo any of them. If the script doesn't auto-complete a certain entry type in this mode, then it's because it can't be auto-completed without the risk of disqualification, and so you'll have to complete it manually.

**Disclaimer**: The usage of this script violates Gleam.io's Terms of Service.  Use at your own risk.

##Installation
1. Install the [Tampermonkey extension](https://chrome.google.com/webstore/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo?hl=en) (for Chrome) or the [Greasemonkey extension](https://addons.mozilla.org/en-US/firefox/addon/greasemonkey/) (for Firefox)
2. Go [here](https://raw.githubusercontent.com/Citrinate/gleamSolver/master/gleamSolver.user.js)
3. Click "Install"

By default, the script will auto-update roughly every 24 hours, but you can force an update by re-installing using the link above.

You can test and verify that the script works at any of of the sample giveaways [here](https://gleam.io/examples).
