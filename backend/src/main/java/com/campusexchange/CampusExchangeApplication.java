package com.campusexchange;

import com.campusexchange.category.Category;
import com.campusexchange.category.CategoryRepository;
import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Bean;

import java.util.List;

@SpringBootApplication
public class CampusExchangeApplication {
    public static void main(String[] args) {
        SpringApplication.run(CampusExchangeApplication.class, args);
    }

    /**
     * Seeds the standard categories on initial database creation if not already present.
     */
    @Bean
    CommandLineRunner seedInitialCategories(CategoryRepository repo) {
        return args -> {
            if (repo.count() > 0) return;

            List<String> categories = List.of(
                    "Electronics and project components",
                    "Books and study materials",
                    "Clothing and university merchandise",
                    "Engineering equipment",
                    "Medical and nursing equipment",
                    "Hotel management and culinary equipment",
                    "Sports and fitness equipment",
                    "Other student essentials"
            );

            int order = 0;
            for (String catName : categories) {
                Category c = new Category();
                c.setName(catName);
                c.setSlug(catName.toLowerCase().replaceAll("[^a-z0-9]+", "-"));
                c.setDisplayOrder(order++);
                repo.save(c);
            }
        };
    }
}
