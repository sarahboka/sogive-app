package org.sogive.data.charity;

import java.util.HashMap;
import java.util.Map;

import com.winterwell.utils.web.SimpleJson;

public class NGO extends Thing {
	private static final long serialVersionUID = 1L;

	public NGO(String ourid) {
		put("@id", ourid);
	}

	public void setTags(String tags) {
		put("tags", tags); // TODO split. Notes say & but not sure the data follows that
	}

	/**
	 * Name must be unique or it will overwrite!
	 * @param project
	 */
	public void addProject(Project project) {
		SimpleJson.set(this, project, "project", project.getName());
	}
}
