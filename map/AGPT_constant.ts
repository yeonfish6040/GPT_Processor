export let parent = {
    tStart: "thread_start",
    sMain: "start_main",
}

export let child = {
    SDC: "started_driver_check",
    CDC: "checked_driver_connected",
    CDR: "checked_driver_registered",
    FDC: "finish_driver_check",
    CPF: "checking_process_file",
    SPP: "started_process_producing",
    WGG: "we_got_goals",
    SRP: "started_running_process",
    PGU: "progress_update",
    progress: {
        goals: "now_we_have_goals",
    },

    error: {
        DNF: "driver_not_found",
        DNC: "driver_not_connected",
        RPE: "running_progress_exists",
        OAE: "openai_error",
    },
    log: "log",
}